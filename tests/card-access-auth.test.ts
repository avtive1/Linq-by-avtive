import { describe, expect, it } from "vitest";
import { issueAttendeeCardToken, tokenGrantsCardViewAccess, verifyAttendeeCardToken } from "@/lib/security/tokens";

describe("Card Access and Authorization", () => {
  const cardId1 = "11111111-1111-4111-8111-111111111111";
  const cardId2 = "22222222-2222-4222-8222-222222222222";

  it("grants view access when token matches cardId and has read/edit scope", async () => {
    const token = await issueAttendeeCardToken({
      sub: "user_test_123",
      cardId: cardId1,
      scope: "card:read",
    });

    const verified = await verifyAttendeeCardToken(token);
    expect(verified.payload.cardId).toBe(cardId1);

    const allowsView = tokenGrantsCardViewAccess(
      verified.payload.scope,
      cardId1,
      verified.payload.cardId,
    );
    expect(allowsView).toBe(true);
  });

  it("grants view access for card:edit scope as well", async () => {
    const token = await issueAttendeeCardToken({
      sub: "public-registration",
      cardId: cardId1,
      scope: "card:edit",
    });

    const verified = await verifyAttendeeCardToken(token);
    const allowsView = tokenGrantsCardViewAccess(
      verified.payload.scope,
      cardId1,
      verified.payload.cardId,
    );
    expect(allowsView).toBe(true);
  });

  it("denies access when token is presented for a different card ID", async () => {
    const token = await issueAttendeeCardToken({
      sub: "user_test_123",
      cardId: cardId1,
      scope: "card:read",
    });

    const verified = await verifyAttendeeCardToken(token);
    const allowsView = tokenGrantsCardViewAccess(
      verified.payload.scope,
      cardId2, // Mismatched cardId
      verified.payload.cardId,
    );
    expect(allowsView).toBe(false);
  });

  it("denies access when token scope is unrelated", async () => {
    const allowsView = tokenGrantsCardViewAccess(
      "other:scope",
      cardId1,
      cardId1,
    );
    expect(allowsView).toBe(false);
  });
});
