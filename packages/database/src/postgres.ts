import { Pool, types, type PoolClient, type PoolConfig } from 'pg';
import type { Database, MigrationClient, Queryable, QueryResult } from './client.js';

/**
 * The real Postgres adapter — deployment plan slice 2.
 *
 * Implements the same port as PGlite so the services cannot tell them apart.
 * Two things in here are not boilerplate and are the reason this file has a
 * long comment: the `date` type parser, and the migration advisory lock.
 */

/* -------------------------------------------------------------- type parsing */

/**
 * OID 1082 is `date`.
 *
 * node-postgres parses a bare `date` into a JavaScript `Date` at **local**
 * midnight. Every date in this system is a calendar day with no time in it — an
 * inspection's `needed_by`, a visit's `starts_on`, a draw's `due_date` — and the
 * code turns them into strings with `toISOString().slice(0, 10)`.
 *
 * In any timezone east of UTC, local midnight is the *previous* day in UTC, so
 * that round trip silently moves every date back by one. A last-safe-request
 * date one day early is merely annoying; a visit that reads as the day before it
 * was booked is a crew sent on the wrong morning.
 *
 * Returning the raw string removes the ambiguity rather than managing it, and
 * makes Postgres behave exactly as PGlite already does — which is what lets one
 * test suite cover both. `asDay` helpers throughout the services already accept
 * `string | Date`, so the string path is the one they were written for.
 *
 * Deliberately NOT overridden: `timestamptz` (1184) and `timestamp` (1114).
 * Those carry a real instant, `new Date(...).toISOString()` is correct for them,
 * and both drivers agree.
 */
const DATE_OID = 1082;
types.setTypeParser(DATE_OID, (value: string) => value);

/* ------------------------------------------------------------ the connection */

export interface PostgresOptions {
  /** Standard connection URL. */
  readonly url: string;
  /**
   * Pool ceiling. A pilot with a handful of users does not need many, and a
   * small number fails fast and visibly rather than queueing invisibly when
   * something leaks a connection.
   */
  readonly maxConnections?: number;
  /** PEM for providers that present a private CA. */
  readonly caCertificate?: string;
  /** Shows up in `pg_stat_activity`, which is worth having when it is 2am. */
  readonly applicationName?: string;
  /** Called when the pool reports an error on an idle client. */
  readonly onPoolError?: (error: Error) => void;
}

/*
 * `[::1]` carries its brackets: `new URL(...).hostname` keeps them for IPv6, so the bare
 * `::1` below never matched anything and IPv6 loopback was silently getting TLS forced on.
 * Both spellings are kept because only one of them is what the URL parser actually hands us.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '']);

/**
 * TLS configuration, secure by default.
 *
 * Off for a local host, because a loopback development database has no
 * certificate and demanding one only teaches people to pass `--no-verify`.
 * On, **with verification**, for anything else. `sslmode=disable` in the URL is
 * honoured because it is an explicit statement, but there is deliberately no
 * option here that turns verification off while leaving TLS on: that
 * combination looks encrypted and authenticates nothing.
 */
export const resolveSsl = (
  url: string,
  caCertificate?: string,
): PoolConfig['ssl'] => {
  const parsed = new URL(url);
  if (parsed.searchParams.get('sslmode') === 'disable') return false;
  if (LOCAL_HOSTS.has(parsed.hostname)) return false;
  return caCertificate
    ? { rejectUnauthorized: true, ca: caCertificate }
    : { rejectUnauthorized: true };
};

/*
 * The driver types rows as `QueryResultRow` — an index signature — while every
 * call site in this codebase declares the shape it expects. The cast is the one
 * place that gap is crossed, so it is here and named rather than spread across
 * a hundred queries.
 */
const toResult = <Row>(result: { rows: unknown[]; rowCount: number | null }): QueryResult<Row> => ({
  rows: result.rows as Row[],
  // pg reports null for statements that affect nothing countable; the port says
  // absent rather than zero, because "no rows changed" and "not a counting
  // statement" are different facts.
  ...(result.rowCount === null ? {} : { affectedRows: result.rowCount }),
});

/** Wraps a checked-out client so a transaction body cannot reach the pool. */
const asQueryable = (client: PoolClient): Queryable => ({
  async query<Row>(sql: string, params?: unknown[]): Promise<QueryResult<Row>> {
    return toResult<Row>(await client.query(sql, params as unknown[] | undefined));
  },
});

/**
 * A fixed key for the migration advisory lock.
 *
 * Any constant works as long as every instance uses the same one. This is
 * `'apex'` in ASCII (0x61706578) — arbitrary, but recognisable in
 * `pg_locks.objid` when someone is working out why a deploy is waiting.
 */
const MIGRATION_LOCK_KEY = 0x61706578;

export class PostgresDatabase implements Database {
  private constructor(private readonly pool: Pool) {}

  static create(options: PostgresOptions): PostgresDatabase {
    const pool = new Pool({
      connectionString: options.url,
      max: options.maxConnections ?? 10,
      ssl: resolveSsl(options.url, options.caCertificate),
      application_name: options.applicationName ?? 'apex-os',
      // A request that cannot get a connection should fail while someone is
      // still watching, not hang until the client gives up.
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });

    /*
     * An unhandled 'error' on an idle client takes the whole process down. The
     * pool discards the client either way; this exists so a database restart
     * degrades into reconnects instead of a crash loop.
     */
    pool.on('error', (error) => {
      if (options.onPoolError) options.onPoolError(error);
      else console.error('[apex] idle Postgres client error', error);
    });

    return new PostgresDatabase(pool);
  }

  async query<Row>(sql: string, params?: unknown[]): Promise<QueryResult<Row>> {
    return toResult<Row>(await this.pool.query(sql, params as unknown[] | undefined));
  }

  async transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await work(asQueryable(client));
      await client.query('commit');
      return result;
    } catch (error) {
      // Rollback can itself fail if the connection died mid-transaction. The
      // original error is what the caller needs to see, so this must not
      // replace it.
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run migrations under a session-level advisory lock.
   *
   * Embedded Postgres never needed this because there was exactly one process.
   * A deployment can start two instances at once, and both would then race the
   * same `0018` — one succeeding, the other failing on a duplicate object, with
   * the loser crash-looping.
   *
   * The lock has to be taken on the *same connection* the migrations run on,
   * which is why this checks out a single client and hands `work` a client-bound
   * `MigrationClient` rather than the pool.
   *
   * The second instance blocks here until the first finishes, then finds every
   * migration already recorded and applies none.
   */
  async withMigrationLock<T>(work: (client: MigrationClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
      return await work({
        ...asQueryable(client),
        exec: (sql: string) => client.query(sql),
      });
    } finally {
      // Released explicitly rather than left to the session ending, so a pooled
      // connection returning to the pool does not carry the lock with it.
      await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => undefined);
      client.release();
    }
  }

  /** True when the database answers. Used by the readiness check. */
  async isReachable(): Promise<boolean> {
    try {
      await this.pool.query('select 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
