import { Container, getContainer } from "@cloudflare/containers";

/**
 * Staging front door for Apex OS.
 *
 * The app is a long-running Node server (node:http, node-postgres, the built
 * staff bundle on disk). Cloudflare Containers run that image. This Worker only
 * starts the container and adds the staging noindex header. It does not
 * reimplement the API.
 */

interface Env {
  APEX_OS: DurableObjectNamespace<ApexOsContainer>;
  /**
   * Neon pooled connection string, `sslmode=require`. A Worker secret, not a
   * Hyperdrive binding: Containers cannot reach Hyperdrive.
   */
  CONTAINER_DATABASE_URL: string;
  S3_ENDPOINT: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  S3_REGION: string;
  APEX_PUBLIC_ORIGIN?: string;
  APEX_ACCESS_TEAM: string;
  APEX_ACCESS_AUD: string;
  /** Legacy single-email fallback. Omit once that person's `app_users.email` is set. */
  APEX_ACCESS_EMAIL?: string;
  /** Paired with `APEX_ACCESS_EMAIL`. Omit together with it. */
  APEX_ACCESS_USER_ID?: string;
  APEX_CUSTOMER_CONTACT_PHONE?: string;
  APEX_CUSTOMER_CONTACT_LABEL?: string;
}

const NOINDEX = "noindex, nofollow, noarchive";

export class ApexOsContainer extends Container<Env> {
  defaultPort = 4100;
  sleepAfter = "10m";
  // Required ports are checked on start. The image listens on 4100.
  requiredPorts = [4100];
  // Neon and R2 are on the public internet. The library default is already
  // true; set it here so a later default change cannot cut the container off.
  enableInternet = true;
}

function required(value: string | undefined, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function containerEnv(env: Env): Record<string, string> {
  const values: Record<string, string> = {
    HOST: "0.0.0.0",
    PORT: "4100",
    NODE_ENV: "production",
    APEX_STAGING_NOINDEX: "1",
    DATABASE_URL: required(env.CONTAINER_DATABASE_URL, "CONTAINER_DATABASE_URL"),
    S3_ENDPOINT: required(env.S3_ENDPOINT, "S3_ENDPOINT"),
    S3_BUCKET: required(env.S3_BUCKET, "S3_BUCKET"),
    S3_ACCESS_KEY_ID: required(env.S3_ACCESS_KEY_ID, "S3_ACCESS_KEY_ID"),
    S3_SECRET_ACCESS_KEY: required(env.S3_SECRET_ACCESS_KEY, "S3_SECRET_ACCESS_KEY"),
    S3_REGION: env.S3_REGION || "auto",
    APEX_ACCESS_TEAM: required(env.APEX_ACCESS_TEAM, "APEX_ACCESS_TEAM"),
    APEX_ACCESS_AUD: required(env.APEX_ACCESS_AUD, "APEX_ACCESS_AUD"),
  };
  if (env.APEX_ACCESS_EMAIL?.trim()) values.APEX_ACCESS_EMAIL = env.APEX_ACCESS_EMAIL.trim();
  if (env.APEX_ACCESS_USER_ID?.trim()) values.APEX_ACCESS_USER_ID = env.APEX_ACCESS_USER_ID.trim();
  if (env.APEX_PUBLIC_ORIGIN?.trim()) {
    values.APEX_PUBLIC_ORIGIN = env.APEX_PUBLIC_ORIGIN.trim();
  }
  if (env.APEX_CUSTOMER_CONTACT_PHONE) {
    values.APEX_CUSTOMER_CONTACT_PHONE = env.APEX_CUSTOMER_CONTACT_PHONE;
  }
  if (env.APEX_CUSTOMER_CONTACT_LABEL) {
    values.APEX_CUSTOMER_CONTACT_LABEL = env.APEX_CUSTOMER_CONTACT_LABEL;
  }
  return values;
}

function withNoindex(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("x-robots-tag", NOINDEX);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nDisallow: /\n", {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-robots-tag": NOINDEX,
        },
      });
    }

    const container = getContainer(env.APEX_OS, "staging");
    try {
      await container.startAndWaitForPorts({
        startOptions: { envVars: containerEnv(env), enableInternet: true },
        cancellationOptions: { portReadyTimeoutMS: 120_000 },
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      const safe = detail.includes("://") || /postgres(ql)?:/i.test(detail) ? "start failed" : detail;
      console.error(`apex-os staging failed to start: ${safe || "start failed"}`);
      return withNoindex(
        new Response("Apex OS staging is not ready. See docs/runbooks/cloudflare-staging.md.", {
          status: 503,
        }),
      );
    }

    return withNoindex(await container.fetch(request));
  },
};
