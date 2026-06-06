# Connection Pooling Audit & Configuration

## Findings (pre-optimization)

| Question | Answer |
|----------|--------|
| New DB connection per request? | **No** — singleton `NeonQueryFunction` per Node process |
| Connections reused? | **Yes** — same client instance; HTTP fetch connection cache enabled |
| Connections released? | N/A for HTTP driver — no manual `release()` required |
| Serverless connection storms? | Mitigated by Neon **pooler URL** (`-pooler` hostname) + singleton client |
| Per-request `new PrismaClient()`? | **N/A** — app uses raw SQL via `@neondatabase/serverless`, not Prisma |

## Architecture

```
Next.js API route
       │
       ▼
  queryNeon()  ──►  singleton neon() client  ──►  Neon Pooler (PgBouncer)
       │                    (HTTP/WebSocket)              │
       │                                                  ▼
       └── retry + reset on transient errors         PostgreSQL
```

**Stack:** PostgreSQL on Neon, `@neondatabase/serverless` HTTP driver, no Prisma/Drizzle.

## Configuration

| Env var | Purpose | Default |
|---------|---------|---------|
| `DATABASE_URL` | **Runtime** — must use Neon pooler URL in production | — |
| `DATABASE_URL_DIRECT` | Migrations / one-off scripts only | — |
| `DB_POOL_MAX_RETRIES` | Transient failure retries | `3` |
| `DB_POOL_RETRY_BACKOFF_MS` | Backoff base (× attempt) | `150` |
| `DB_POOL_WARN_DIRECT` | Warn if non-pooler URL in production | `true` (set `false` to silence) |

## Pool sizing (Neon-managed)

Application-level TCP pool size is **not** configured — Neon pooler handles connection multiplexing. Tune at the Neon console:

- **Pool mode:** Transaction (recommended for serverless/Next.js)
- **Max connections:** Match Neon plan limits; avoid oversized app-side pools

## Monitoring checklist

- [ ] `DATABASE_URL` hostname contains `-pooler`
- [ ] No "too many connections" in Neon dashboard during load test
- [ ] P95 API latency stable under `npm run load-test:smoke`
- [ ] `getConnectionLifecycleReport()` shows `usingPoolerUrl: true` in production

## Code locations

| File | Role |
|------|------|
| `src/lib/db/pool.ts` | Connection string, singleton client, pool config |
| `src/lib/neon-db.ts` | Public query API (unchanged exports) |

## Load testing

```bash
npm run dev   # terminal 1
npm run load-test:smoke
```

Extend `scripts/load-test/smoke-load.mjs` or use k6/Artillery for authenticated scenarios.
