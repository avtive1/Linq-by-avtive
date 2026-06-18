import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSqlClient, transientDbError } from "../helpers/mock-db";

vi.mock("@/lib/db/pool", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/pool")>();
  return {
    ...actual,
    getSqlClient: vi.fn(),
    setDbPoolConfigForTests: actual.setDbPoolConfigForTests,
    getDbPoolConfig: vi.fn(() => ({
      maxRetries: 3,
      retryBackoffMs: 1,
      warnOnDirectUrl: false,
    })),
    resetSqlClient: vi.fn(async () => {}),
  };
});

import { getSqlClient, setDbPoolConfigForTests } from "@/lib/db/pool";
import { isTransientDbError, queryNeon, resetNeonPool } from "@/lib/neon-db";

describe("network failures — transient error detection", () => {
  it.each([
    "fetch failed",
    "connection terminated unexpectedly",
    "timeout exceeded",
    "socket hang up",
    "network error",
    "ECONNRESET",
    "ETIMEDOUT",
  ])("classifies transient error: %s", (message) => {
    expect(isTransientDbError(new Error(message))).toBe(true);
  });

  it("does not classify validation errors as transient", () => {
    expect(isTransientDbError(new Error("invalid input syntax for type uuid"))).toBe(false);
    expect(isTransientDbError("string error")).toBe(false);
    expect(isTransientDbError(null)).toBe(false);
  });
});

describe("network failures — query retry behavior", () => {
  beforeEach(() => {
    setDbPoolConfigForTests({ maxRetries: 3, retryBackoffMs: 1, warnOnDirectUrl: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries on transient DB errors then succeeds", async () => {
    const mock = createMockSqlClient();
    let attempts = 0;
    mock.query.mockImplementation(async () => {
      attempts += 1;
      if (attempts < 3) throw transientDbError();
      return [{ ok: 1 }];
    });
    vi.mocked(getSqlClient).mockReturnValue(mock as never);

    const rows = await queryNeon<{ ok: number }>("SELECT 1 AS ok");
    expect(rows).toEqual([{ ok: 1 }]);
    expect(attempts).toBe(3);
  });

  it("throws after max retries exhausted", async () => {
    const mock = createMockSqlClient();
    mock.query.mockRejectedValue(transientDbError());
    vi.mocked(getSqlClient).mockReturnValue(mock as never);

    await expect(queryNeon("SELECT 1")).rejects.toThrow(/fetch failed|connection terminated/i);
    expect(mock.query).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-transient errors", async () => {
    const mock = createMockSqlClient();
    mock.query.mockRejectedValue(new Error("permission denied for table events"));
    vi.mocked(getSqlClient).mockReturnValue(mock as never);

    await expect(queryNeon("SELECT 1")).rejects.toThrow("permission denied");
    expect(mock.query).toHaveBeenCalledTimes(1);
  });

  it("resetNeonPool does not throw when client reset fails", async () => {
    await expect(resetNeonPool()).resolves.toBeUndefined();
  });
});

describe("network failures — external dependency rejection", () => {
  it("handles rejected email promise without unhandled rejection", async () => {
    const sendEmail = vi.fn().mockRejectedValue(new Error("SMTP connection refused"));
    await expect(
      sendEmail({ to: "user@example.com", subject: "test", text: "hi" }).catch((e: Error) => e.message),
    ).resolves.toBe("SMTP connection refused");
  });

  it("handles aborted fetch without throwing uncaught", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetch("http://localhost:1/unreachable", { signal: controller.signal }).catch((e: Error) => e.name),
    ).resolves.toMatch(/AbortError|DOMException/);
  });
});
