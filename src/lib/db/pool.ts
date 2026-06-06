import {
  neon,
  type NeonQueryFunction,
} from "@neondatabase/serverless";

/**
 * Singleton Neon HTTP client.
 *
 * Connection pooling is handled by Neon's pooler (PgBouncer) when DATABASE_URL
 * uses the `-pooler` hostname. The app reuses one client instance per process —
 * it does not open a new TCP connection per request.
 */
let sqlClient: NeonQueryFunction<false, false> | null = null;

export type DbPoolConfig = {
  /** Max retry attempts for transient failures (default: 3) */
  maxRetries: number;
  /** Base backoff ms between retries (default: 150) */
  retryBackoffMs: number;
  /** Warn when runtime is not using Neon pooler URL (default: true in production) */
  warnOnDirectUrl: boolean;
};

function readPoolConfig(): DbPoolConfig {
  return {
    maxRetries: Math.min(
      Math.max(Number(process.env.DB_POOL_MAX_RETRIES || 3), 1),
      10,
    ),
    retryBackoffMs: Math.min(
      Math.max(Number(process.env.DB_POOL_RETRY_BACKOFF_MS || 150), 50),
      5_000,
    ),
    warnOnDirectUrl:
      process.env.DB_POOL_WARN_DIRECT !== "false" &&
      process.env.NODE_ENV === "production",
  };
}

let poolConfig = readPoolConfig();

export function getDbPoolConfig(): DbPoolConfig {
  return poolConfig;
}

/** @internal Test hook only */
export function setDbPoolConfigForTests(config: Partial<DbPoolConfig>) {
  poolConfig = { ...poolConfig, ...config };
}

function isPoolerUrl(url: string): boolean {
  try {
    const host = new URL(url.replace(/^postgres(ql)?:\/\//, "https://")).hostname;
    return host.includes("-pooler");
  } catch {
    return url.includes("-pooler");
  }
}

/**
 * Prefer Neon pooler URL for runtime API traffic.
 * Falls back to DATABASE_URL_DIRECT only when pooler is not configured.
 */
export function getConnectionString(): string {
  const pooler = process.env.DATABASE_URL?.trim();
  const direct = process.env.DATABASE_URL_DIRECT?.trim();
  let value = pooler || direct;

  if (!value) {
    throw new Error("Missing DATABASE_URL/DATABASE_URL_DIRECT");
  }

  if (poolConfig.warnOnDirectUrl && !isPoolerUrl(value)) {
    console.warn(
      "[db] DATABASE_URL is not a Neon pooler URL. Use the `-pooler` endpoint in production to avoid connection exhaustion.",
    );
  }

  if (value.includes("postgresql://") || value.includes("postgres://")) {
    value = value
      .replace(/channel_binding=[^&]+&?/g, "")
      .replace(/\?&/, "?")
      .replace(/[?&]$/, "");

    if (!value.includes("sslmode=")) {
      const separator = value.includes("?") ? "&" : "?";
      value = `${value}${separator}sslmode=require`;
    } else {
      value = value.replace(/sslmode=[^&]+/g, "sslmode=require");
    }
  }

  return value;
}

export function getSqlClient(): NeonQueryFunction<false, false> {
  if (!sqlClient) {
    sqlClient = neon(getConnectionString());
  }
  return sqlClient;
}

export async function resetSqlClient(): Promise<void> {
  sqlClient = null;
}

export function getConnectionLifecycleReport(): {
  clientInstantiated: boolean;
  usingPoolerUrl: boolean;
  connectionStringSource: "DATABASE_URL" | "DATABASE_URL_DIRECT";
  config: DbPoolConfig;
} {
  const pooler = process.env.DATABASE_URL?.trim();
  const direct = process.env.DATABASE_URL_DIRECT?.trim();
  let usingPoolerUrl = false;
  try {
    usingPoolerUrl = isPoolerUrl(getConnectionString());
  } catch {
    usingPoolerUrl = false;
  }

  return {
    clientInstantiated: sqlClient !== null,
    usingPoolerUrl,
    connectionStringSource: pooler ? "DATABASE_URL" : "DATABASE_URL_DIRECT",
    config: poolConfig,
  };
}
