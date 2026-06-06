# Database Index Audit Report

Generated from static analysis of all SQL in `src/`. Indexes are applied via `database/indexes/performance-indexes.sql` (idempotent, production-safe).

## Summary

| Area | Tables audited | New indexes | Existing indexes preserved |
|------|----------------|-------------|----------------------------|
| Dashboard / events | events, attendees | 3 | events_short_id_idx |
| Org & permissions | organization_members, access_grants | 7 | — |
| Access workflow | access_requests | 3 | — |
| Registration approval | registration_requests | 3 | org_status, event_status, pending_email |
| Auth & org onboarding | auth_users, profiles, organizations, login_email_otp | 6 | auth_users_email, clerk_user_id |
| Short links | short_links | 1 (reinforce) | slug unique |

---

## Index Recommendations by Table

### `events`

| Column(s) | Query usage | Current index | Recommended index |
|-----------|-------------|---------------|-------------------|
| `user_id` | `WHERE e.user_id = $1` + `ORDER BY created_at DESC` (dashboard list) | PK on `id` only | `events_user_id_created_at_idx (user_id, created_at DESC)` |
| `short_id` | `/r/{slug}` lookup | `events_short_id_idx` (runtime ensure) | Keep unique index |
| `id` | PK lookups | Primary key | — |

### `attendees`

| Column(s) | Query usage | Current index | Recommended index |
|-----------|-------------|---------------|-------------------|
| `event_id` | `WHERE event_id = $1 ORDER BY created_at DESC` | Often none | `attendees_event_id_created_at_idx` |
| `user_id` | Card ownership checks | — | `attendees_user_id_idx` (partial, non-null) |
| `id` | PK / card page | Primary key | — |

### `organization_members`

| Column(s) | Query usage | Current index | Recommended index |
|-----------|-------------|---------------|-------------------|
| `member_user_id`, `status` | Active membership checks | — | `organization_members_member_status_idx` |
| `member_user_id`, `org_owner_user_id`, `status` | Permission gate (`LIMIT 1`) | — | `idx_org_members_permission_lookup` |
| `org_owner_user_id`, `created_at` | Member list + pagination | — | `organization_members_org_owner_created_at_idx` |
| `invite_token_hash` | Invite accept flow | — | Partial index |
| `member_email` | Pending invite lookup | — | Partial index |

### `access_requests`

| Column(s) | Query usage | Current index | Recommended index |
|-----------|-------------|---------------|-------------------|
| `event_id`, `status`, `created_at` | Event pending queue | partial index | `idx_access_requests_event_status_created` |
| `owner_user_id`, `status`, `created_at` | Owner inbox | — | Composite index |
| `requester_user_id`, `created_at` | "My requests" list | — | Composite index |

### `access_grants`

| Column(s) | Query usage | Current index | Recommended index |
|-----------|-------------|---------------|-------------------|
| `grantee_user_id`, `status` | Permission resolution | — | Composite index |
| `event_id` | Event-scoped grants / deletes | — | Partial index |
| `granted_by_user_id`, `status` | Owner grant templates | — | Composite index |

### `registration_requests`

| Column(s) | Query usage | Current index | Recommended index |
|-----------|-------------|---------------|-------------------|
| `event_id`, `status` | Pending count / list | `registration_requests_event_status_idx` | Extend with `created_at` for sort |
| `organization_id`, `status` | Org-wide views | `registration_requests_org_status_idx` | Keep |
| `card_id` | Approved guest lock lookup | — | Partial index |
| `event_id`, `card_email_lookup_tag` | Pending dedup | Unique partial (existing) | Keep |

### `auth_users` / `profiles` / `organizations`

| Column(s) | Query usage | Recommended index |
|-----------|-------------|-------------------|
| `email_normalized` | Login, signup | — | `idx_auth_users_email_norm` (column + index, replaces `lower(email)` scans) |
| `reset_token_hash` | Password reset | Partial index |
| `username` | Profile availability | `profiles_username_idx` |
| `organization_name_key` | Org uniqueness | Index on profiles + organizations |
| `owner_user_id` | Org owner lookups | `organizations_owner_user_id_idx` |

---

## Foreign Key Index Verification

PostgreSQL does **not** auto-index FK columns. Recommended indexes above cover:

- `attendees.event_id` → `events.id`
- `registration_requests.event_id`, `card_id`, `user_id`
- `access_requests.event_id`, `requester_user_id`, `owner_user_id`
- `access_grants.event_id`, `grantee_user_id`, `granted_by_user_id`
- `organization_members.member_user_id`, `org_owner_user_id`
- `organizations.owner_user_id`

Run `npm run db:audit:indexes` after applying migrations to list any remaining gaps from live schema.

---

## Query Plan Verification

```bash
# 1. Apply indexes
npm run db:indexes

# 2. EXPLAIN ANALYZE high-traffic queries
npm run db:audit:explain
```

Optional env for realistic params:

```env
AUDIT_USER_ID=<org-owner-uuid>
AUDIT_EVENT_ID=<event-uuid>
AUDIT_MEMBER_ID=<member-uuid>
AUDIT_OWNER_ID=<owner-uuid>
```

Report output: `database/query-analysis/explain-report.json`

**Success criteria:** Index Scan / Bitmap Index Scan on filtered columns; reduced Seq Scan on large tables.

---

## Slow Query Thresholds

| Tier | Threshold | Action |
|------|-----------|--------|
| Watch | > 100 ms | Monitor in EXPLAIN report |
| Investigate | > 250 ms | Check missing index / N+1 |
| Critical | > 500 ms | Optimize before production load |

Known N+1 patterns (unchanged — documented only):

- `access-requests/inbox` — per-row event name lookup
- `organization-join-requests/inbox` — per-row requester email

These are safe to optimize later without API contract changes.

---

## Applying in Production

1. Deploy code (indexes SQL + ensure script only — **no business logic changes**).
2. Run `npm run db:indexes` against production (or execute `database/indexes/performance-indexes.sql` in Neon SQL editor).
3. Run `npm run db:audit:explain` on staging with production-like data volume.
4. Run `npm run load-test:smoke` against staging.

All index DDL uses `CREATE INDEX IF NOT EXISTS` — safe to re-run.
