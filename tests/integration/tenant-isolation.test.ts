/**
 * Integration tests for multi-tenant isolation (application scoping + PostgreSQL RLS).
 *
 * Requires DATABASE_URL pointing at a database with RLS migration applied.
 * Run: npm run test:integration
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import {
  insertRow,
  queryNeon,
  queryNeonOne,
  runWithRlsBypassAsync,
} from "@/lib/neon-db";
import { runWithTenantContextAsync } from "@/lib/tenant/context";
import { updateTenantRows } from "@/lib/db/tenant-mutations";

// Integration tests create and delete rows in the configured database. Require
// an explicit opt-in so `npm test` cannot touch a developer or production DB.
const hasDatabase =
  process.env.RUN_DB_INTEGRATION_TESTS === "true" &&
  Boolean(process.env.DATABASE_URL?.trim());

function uuid() {
  return crypto.randomUUID();
}

function pgBool(value: unknown): boolean {
  return value === true || value === "t" || value === 1;
}

describe.skipIf(!hasDatabase)("tenant isolation", () => {
  const tenantA = uuid();
  const tenantB = uuid();
  let eventAId = "";
  let eventBId = "";
  let rlsEnabled = false;

  beforeAll(async () => {
    await runWithRlsBypassAsync(async () => {
      const { ensureRlsRuntimeRole } = await import("@/lib/db/ensure-rls-runtime-role");
      await ensureRlsRuntimeRole();

      const rlsRow = await queryNeonOne<{ relrowsecurity: boolean | string }>(
        `SELECT c.relrowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = 'events'
         LIMIT 1`,
      );
      rlsEnabled = pgBool(rlsRow?.relrowsecurity);
    });

    await runWithRlsBypassAsync(async () => {
      const createdA = await insertRow(
        "events",
        {
          user_id: tenantA,
          name: "Tenant A Event",
          description: "",
          location: "Test",
          location_type: "onsite",
          date: "2099-12-31",
          time: "10:00",
          short_id: `ta${Date.now()}`,
        },
        "id",
      );
      const createdB = await insertRow(
        "events",
        {
          user_id: tenantB,
          name: "Tenant B Event",
          description: "",
          location: "Test",
          location_type: "onsite",
          date: "2099-12-31",
          time: "11:00",
          short_id: `tb${Date.now()}`,
        },
        "id",
      );
      eventAId = String(createdA?.id || "");
      eventBId = String(createdB?.id || "");
    });
  });

  afterAll(async () => {
    await runWithRlsBypassAsync(async () => {
      if (eventAId) {
        await queryNeon(`DELETE FROM public.events WHERE id = $1`, [eventAId]);
      }
      if (eventBId) {
        await queryNeon(`DELETE FROM public.events WHERE id = $1`, [eventBId]);
      }
    });
  });

  it("prevents cross-tenant event reads under RLS", async () => {
    expect(rlsEnabled, "RLS must be enabled on public.events (run db:migrate:deploy)").toBe(true);

    const rowsForA = await runWithTenantContextAsync(
      { tenantId: tenantA, userId: tenantA },
      () =>
        queryNeon<{ id: string; name: string }>(
          `SELECT id, name FROM public.events WHERE user_id = $1`,
          [tenantB],
        ),
    );
    expect(rowsForA).toHaveLength(0);
  });

  it("returns only own-tenant events when listing", async () => {
    const rows = await runWithTenantContextAsync(
      { tenantId: tenantA, userId: tenantA },
      () =>
        queryNeon<{ id: string }>(`SELECT id FROM public.events WHERE user_id = $1`, [tenantA]),
    );
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(eventAId);
    expect(ids).not.toContain(eventBId);
  });

  it("blocks cross-tenant updates via tenant-scoped mutations", async () => {
    const updated = await runWithTenantContextAsync(
      { tenantId: tenantA, userId: tenantA },
      () =>
        updateTenantRows(
          "events",
          { name: "Hijacked" },
          { id: eventBId },
          tenantA,
          "id",
        ),
    );
    expect(updated).toHaveLength(0);

    const stillB = await runWithRlsBypassAsync(() =>
      queryNeonOne<{ name: string }>(`SELECT name FROM public.events WHERE id = $1`, [eventBId]),
    );
    expect(stillB?.name).toBe("Tenant B Event");
  });

  it("cannot fetch another tenant event by id under RLS session", async () => {
    expect(rlsEnabled, "RLS must be enabled on public.events (run db:migrate:deploy)").toBe(true);

    const row = await runWithTenantContextAsync(
      { tenantId: tenantA, userId: tenantA },
      () => queryNeonOne<{ id: string }>(`SELECT id FROM public.events WHERE id = $1`, [eventBId]),
    );
    expect(row).toBeNull();
  });
});
