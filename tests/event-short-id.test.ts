import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateRandomShortId, generateUniqueEventShortId, getOrGenerateUniqueShortId } from "@/lib/events/short-id";
import { uniqueViolationError } from "./helpers/mock-db";

describe("event short_id generation", () => {
  it("generates 12-character alphanumeric short IDs", () => {
    const id = generateUniqueEventShortId();
    expect(id).toMatch(/^[0-9a-zA-Z]{12}$/);
    expect(id).toHaveLength(12);
  });

  it("generates distinct high-entropy IDs without collisions across 1,000 iterations", () => {
    const generated = new Set<string>();
    const count = 1000;
    for (let i = 0; i < count; i++) {
      const id = generateUniqueEventShortId();
      generated.add(id);
    }
    expect(generated.size).toBe(count);
  });

  it("generates custom length alphanumeric strings", () => {
    const id8 = generateRandomShortId(8);
    const id16 = generateRandomShortId(16);
    expect(id8).toHaveLength(8);
    expect(id16).toHaveLength(16);
    expect(id8).toMatch(/^[0-9a-zA-Z]{8}$/);
    expect(id16).toMatch(/^[0-9a-zA-Z]{16}$/);
  });
});

describe("short_id collision retry logic", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("retries on unique collision and returns fresh non-colliding ID", async () => {
    let callCount = 0;
    vi.doMock("@/lib/neon-db", () => ({
      queryNeonOneAsSystem: vi.fn(async (query: string, params: unknown[]) => {
        callCount++;
        // Simulate collision on first 2 attempts
        if (callCount <= 2) {
          return { id: "existing-event-id" };
        }
        return null;
      }),
    }));

    const { getOrGenerateUniqueShortId } = await import("@/lib/events/short-id");
    const uniqueId = await getOrGenerateUniqueShortId(5);

    expect(callCount).toBe(3);
    expect(uniqueId).toMatch(/^[0-9a-zA-Z]{12}$/);
  });
});
