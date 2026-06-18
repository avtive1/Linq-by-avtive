import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/neon-db", () => ({
  queryNeonOne: vi.fn(),
  queryNeon: vi.fn(),
  insertRow: vi.fn(),
}));

vi.mock("@/lib/services/registration-schema", () => ({
  ensureRegistrationRequestsSchema: vi.fn(async () => {}),
}));

import { queryNeon, queryNeonOne } from "@/lib/neon-db";
import {
  countPendingRegistrationsForEvent,
  listPendingRegistrationRequests,
  getRegistrationRequestById,
} from "@/lib/services/registration.service";
import { parseQueryParams } from "@/lib/middlewares/validateRequest";
import { paginationQuerySchema } from "@/lib/validators/common.validator";

describe("empty states — registration service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero pending count when no rows match", async () => {
    vi.mocked(queryNeonOne).mockResolvedValue({ count: "0" });

    const count = await countPendingRegistrationsForEvent("550e8400-e29b-41d4-a716-446655440000");
    expect(count).toBe(0);
  });

  it("returns empty requests for unauthorized reviewer without throwing", async () => {
    vi.mocked(queryNeonOne).mockImplementation(async (sql: string) => {
      if (sql.includes("FROM public.events")) {
        return { id: "event-1", user_id: "owner-1" };
      }
      if (sql.includes("organization_members")) {
        return null;
      }
      return null;
    });
    vi.mocked(queryNeon).mockResolvedValue([]);

    const result = await listPendingRegistrationRequests({
      eventId: "550e8400-e29b-41d4-a716-446655440000",
      reviewerUserId: "stranger-1",
    });

    expect(result.requests).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("returns null for missing registration request id", async () => {
    vi.mocked(queryNeonOne).mockResolvedValue(null);

    const row = await getRegistrationRequestById("550e8400-e29b-41d4-a716-446655440000");
    expect(row).toBeNull();
  });

  it("returns empty list when event does not exist", async () => {
    vi.mocked(queryNeonOne).mockResolvedValue(null);

    await expect(
      listPendingRegistrationRequests({
        eventId: "550e8400-e29b-41d4-a716-446655440000",
        reviewerUserId: "owner-1",
      }),
    ).rejects.toThrow("Event not found.");
  });
});

describe("empty states — pagination defaults", () => {
  it("accepts empty query params object", () => {
    const parsed = parseQueryParams(new URLSearchParams(), paginationQuerySchema);
    expect(parsed.ok).toBe(true);
  });
});

describe("empty states — dashboard bootstrap shape (unauthenticated)", () => {
  it("defines stable empty bootstrap payload fields", () => {
    const emptyBootstrap = {
      userId: "",
      isAdmin: false,
      profile: null,
      member: null,
      ownerSignals: null,
      ownerOnboarding: null,
      myAccessRequests: [],
      myJoinRequests: [],
      inboxRequests: [],
      orgJoinInbox: [],
      failedNotifications: [],
    };

    expect(emptyBootstrap.myAccessRequests).toEqual([]);
    expect(emptyBootstrap.member).toBeNull();
    expect(emptyBootstrap.userId).toBe("");
  });
});

describe("empty states — organization member list", () => {
  it("handles zero members from query without error", async () => {
    vi.mocked(queryNeon).mockResolvedValue([]);
    vi.mocked(queryNeonOne).mockResolvedValue({ count: "0" });

    const members = await queryNeon("SELECT id FROM public.organization_members WHERE org_owner_user_id = $1", [
      "owner-1",
    ]);
    const countRow = await queryNeonOne(
      "SELECT COUNT(*)::text AS count FROM public.organization_members WHERE org_owner_user_id = $1",
      ["owner-1"],
    );

    expect(members).toEqual([]);
    expect(Number(countRow?.count || 0)).toBe(0);
  });
});
