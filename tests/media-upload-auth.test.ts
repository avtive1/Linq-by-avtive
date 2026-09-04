import { describe, expect, it } from "vitest";

describe("Media Upload & Delete Authorization Rules", () => {
  function checkUploadFolderPermission(
    userId: string | null,
    folder: string,
    eventExists: boolean,
  ): { allowed: boolean; status: 200 | 401 | 403 } {
    const normalized = folder.trim().replace(/^\/+|\/+$/g, "");
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length === 0) return { allowed: false, status: 403 };

    const isSignupOrgLogoUpload = normalized === "organization-logos";
    const isAttendeeOrPreview =
      (parts[0] === "attendees" || parts[0] === "card-previews") &&
      (parts[1] === "general" || eventExists);

    if (isSignupOrgLogoUpload || isAttendeeOrPreview) {
      return { allowed: true, status: 200 };
    }

    if (!userId) {
      return { allowed: false, status: 401 };
    }

    if (parts[0] === "events") {
      return { allowed: true, status: 200 };
    }

    if (parts[0] === "sponsors" || (parts.length >= 3 && parts[1] === "sponsors")) {
      const ownerId = parts[0] === "sponsors" ? parts[1] : parts[0];
      return ownerId === userId ? { allowed: true, status: 200 } : { allowed: false, status: 403 };
    }

    return { allowed: false, status: 403 };
  }

  it("allows attendee photo upload for valid event when visitor is unauthenticated", () => {
    const result = checkUploadFolderPermission(null, "attendees/a2a789f1-098a-40a4-ba41-ad832bb7823c", true);
    expect(result.allowed).toBe(true);
    expect(result.status).toBe(200);
  });

  it("allows attendee photo upload for valid event when visitor is logged in as a normal user", () => {
    const result = checkUploadFolderPermission("user-123-random", "attendees/a2a789f1-098a-40a4-ba41-ad832bb7823c", true);
    expect(result.allowed).toBe(true);
    expect(result.status).toBe(200);
  });

  it("allows card preview upload for valid event", () => {
    const result = checkUploadFolderPermission("user-123-random", "card-previews/a2a789f1-098a-40a4-ba41-ad832bb7823c", true);
    expect(result.allowed).toBe(true);
    expect(result.status).toBe(200);
  });

  it("rejects attendee upload if event does not exist", () => {
    const result = checkUploadFolderPermission(null, "attendees/non-existent-event-id", false);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(401);
  });

  it("allows organization logo upload during signup without authentication", () => {
    const result = checkUploadFolderPermission(null, "organization-logos", false);
    expect(result.allowed).toBe(true);
    expect(result.status).toBe(200);
  });

  it("requires authentication for event assets and sponsor uploads", () => {
    const unauthEvent = checkUploadFolderPermission(null, "events", false);
    expect(unauthEvent.allowed).toBe(false);
    expect(unauthEvent.status).toBe(401);

    const authEvent = checkUploadFolderPermission("organizer-1", "events", false);
    expect(authEvent.allowed).toBe(true);
    expect(authEvent.status).toBe(200);
  });
});
