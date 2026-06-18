import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSqlClient, transientDbError } from "../helpers/mock-db";

vi.mock("@/lib/db/pool", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/pool")>();
  return {
    ...actual,
    getSqlClient: vi.fn(),
    setDbPoolConfigForTests: actual.setDbPoolConfigForTests,
    getDbPoolConfig: vi.fn(() => ({
      maxRetries: 2,
      retryBackoffMs: 1,
      warnOnDirectUrl: false,
    })),
    resetSqlClient: vi.fn(async () => {}),
  };
});

import { getSqlClient, setDbPoolConfigForTests } from "@/lib/db/pool";
import { queryNeon } from "@/lib/neon-db";

describe("resource exhaustion — slow and unavailable database", () => {
  beforeEach(() => {
    setDbPoolConfigForTests({ maxRetries: 2, retryBackoffMs: 1, warnOnDirectUrl: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails fast when database is unavailable (no hang)", async () => {
    const mock = createMockSqlClient();
    mock.query.mockRejectedValue(transientDbError());
    vi.mocked(getSqlClient).mockReturnValue(mock as never);

    const started = Date.now();
    await expect(queryNeon("SELECT 1")).rejects.toThrow();
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(5_000);
    expect(mock.query.mock.calls.length).toBe(2);
  });

  it("handles slow query that eventually responds", async () => {
    const mock = createMockSqlClient();
    mock.query.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([{ id: "1" }]), 50);
        }),
    );
    vi.mocked(getSqlClient).mockReturnValue(mock as never);

    const rows = await queryNeon<{ id: string }>("SELECT id FROM public.events LIMIT 1");
    expect(rows).toEqual([{ id: "1" }]);
  });

  it("survives repeated failures without leaking unresolved promises", async () => {
    const mock = createMockSqlClient();
    mock.query.mockRejectedValue(new Error("connection pool exhausted"));
    vi.mocked(getSqlClient).mockReturnValue(mock as never);

    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () => queryNeon("SELECT 1")),
    );

    expect(attempts.every((a) => a.status === "rejected")).toBe(true);
  });
});

describe("resource exhaustion — oversized payload handling", () => {
  it("rejects oversized registration review reason", async () => {
    const { registrationReviewBodySchema } = await import("@/lib/validators/registration.validator");
    const result = registrationReviewBodySchema.safeParse({
      decision: "reject",
      rejectionReason: "x".repeat(600),
    });
    expect(result.success).toBe(false);
  });

  it("rejects oversized short link target path", async () => {
    const { shortLinkCreateBodySchema } = await import("@/lib/validators/registration.validator");
    const result = shortLinkCreateBodySchema.safeParse({
      targetPath: "/" + "a".repeat(3000),
    });
    expect(result.success).toBe(false);
  });
});
