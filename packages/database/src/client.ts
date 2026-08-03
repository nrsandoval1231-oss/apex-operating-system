/**
 * The database port.
 *
 * Every service in Apex OS used to take `PGlite` directly, which meant the
 * embedded development database was a type-level dependency of the domain
 * services and there was no seam to put a real Postgres connection behind.
 * This file is that seam.
 *
 * It is deliberately the smallest possible interface: `query`, `transaction`,
 * and — for the migration runner alone — `exec`. That is the entire surface the
 * services actually use, verified against the call sites rather than guessed at.
 * A wider port would be a wider thing to keep two implementations honest about.
 *
 * PGlite satisfies these structurally, so nothing had to be wrapped and no test
 * changed when this was introduced. The Postgres adapter (deployment plan
 * slice 2) implements the same shape over a connection pool.
 *
 * WHAT THIS PORT DELIBERATELY DOES NOT EXPOSE:
 *
 *   · `sql` template tags. Every query in this codebase is a parameterised
 *     string, and keeping it that way means there is exactly one thing to audit
 *     for injection rather than two.
 *   · `listen` / `notify`. Nothing uses them, and a port that promises them
 *     would have to make PGlite and Postgres agree about delivery semantics.
 *   · Nested transactions. `transaction` is flat because every call site is.
 */

export interface QueryResult<Row> {
  readonly rows: Row[];
  /** Present on writes. Reads leave it undefined rather than reporting zero. */
  readonly affectedRows?: number;
}

/**
 * Something that can run a parameterised statement.
 *
 * Satisfied by a pool, a single connection, and a transaction alike, which is
 * what lets a service method take either without knowing which it has.
 */
export interface Queryable {
  query<Row>(sql: string, params?: unknown[]): Promise<QueryResult<Row>>;
}

export interface Database extends Queryable {
  /**
   * Run `work` inside a transaction, committing on return and rolling back if
   * it throws.
   *
   * The callback receives a `Queryable`, not the `Database`, so a nested
   * `transaction` call is a type error rather than a runtime surprise about
   * which connection a statement landed on.
   */
  transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T>;
}

/**
 * Additionally able to run multi-statement SQL.
 *
 * Only the migration runner needs this: a migration file is a script with its
 * own `begin`/`commit`, not a parameterised statement. Keeping it off
 * `Database` means no service can reach for it.
 */
export interface MigrationClient extends Queryable {
  exec(sql: string): Promise<unknown>;
}
