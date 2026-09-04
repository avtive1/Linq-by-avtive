import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  generateAttendanceQrPayload,
  parseAndVerifyAttendanceQrPayload,
  computeAttendanceHmac,
} from "@/lib/security/attendance-qr";
import {
  markAttendanceByQrScan,
  markAttendeeAttendanceById,
  formatAttendeeLinkedInUrl,
  extractCardIdFromQrPayload,
} from "@/lib/services/attendance.service";
import * as neonDb from "@/lib/neon-db";
import * as utils from "@/lib/utils";

vi.mock("@/lib/neon-db", () => ({
  queryNeon: vi.fn(),
  queryNeonOne: vi.fn(),
}));

vi.mock("@/lib/utils", () => {
  const actual = vi.importActual("@/lib/utils");
  return {
    ...actual,
    getEventStatus: vi.fn(),
  };
});

describe("attendance-qr security and helper functions", () => {
  const attendeeId = "a2a789f1-098a-40a4-ba41-ad832bb7823c";
  const eventId = "b3b890a2-109b-41b5-8b52-be943cc8934d";
  const code = "123456";

  it("generates a valid, parseable QR payload", () => {
    const rawPayload = generateAttendanceQrPayload({ attendeeId, eventId, code });
    const parsed = JSON.parse(rawPayload);

    expect(parsed.attendeeId).toBe(attendeeId);
    expect(parsed.eventId).toBe(eventId);
    expect(parsed.code).toBe(code);
    expect(parsed.signature).toBe(computeAttendanceHmac(attendeeId, eventId, code));
  });

  it("successfully verifies a valid QR payload", () => {
    const rawPayload = generateAttendanceQrPayload({ attendeeId, eventId, code });
    const verification = parseAndVerifyAttendanceQrPayload(rawPayload);

    expect(verification.valid).toBe(true);
    expect(verification.payload?.attendeeId).toBe(attendeeId);
    expect(verification.payload?.eventId).toBe(eventId);
    expect(verification.payload?.code).toBe(code);
  });

  it("rejects a QR payload with missing parameters", () => {
    const rawPayload = JSON.stringify({ attendeeId, eventId });
    const verification = parseAndVerifyAttendanceQrPayload(rawPayload);

    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain("Invalid QR code format");
  });

  it("rejects a tampered QR payload signature", () => {
    const rawPayload = generateAttendanceQrPayload({ attendeeId, eventId, code });
    const parsed = JSON.parse(rawPayload);
    parsed.code = "654321"; // Tamper with the code
    const tamperedPayload = JSON.stringify(parsed);

    const verification = parseAndVerifyAttendanceQrPayload(tamperedPayload);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain("Invalid QR code signature");
  });
});

describe("markAttendanceByQrScan service validation rules", () => {
  const attendeeId = "a2a789f1-098a-40a4-ba41-ad832bb7823c";
  const eventId = "b3b890a2-109b-41b5-8b52-be943cc8934d";
  const ownerUserId = "user-999";
  const code = "123456";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error if the event does not exist", async () => {
    vi.spyOn(neonDb, "queryNeonOne").mockResolvedValue(null);

    const payload = generateAttendanceQrPayload({ attendeeId, eventId, code });
    const result = await markAttendanceByQrScan({ eventId, qrPayload: payload, ownerUserId });

    expect(result.success).toBe(false);
    expect(result.message).toBe("Event not found.");
  });

  it("returns error if the user is not the event owner", async () => {
    vi.spyOn(neonDb, "queryNeonOne").mockResolvedValue({
      id: eventId,
      user_id: "other-user",
      date: "2026-08-05",
    });

    const payload = generateAttendanceQrPayload({ attendeeId, eventId, code });
    const result = await markAttendanceByQrScan({ eventId, qrPayload: payload, ownerUserId });

    expect(result.success).toBe(false);
    expect(result.message).toBe("Forbidden.");
  });

  it("returns error if the event is not live", async () => {
    vi.spyOn(neonDb, "queryNeonOne").mockResolvedValue({
      id: eventId,
      user_id: ownerUserId,
      date: "2026-08-01",
    });
    vi.spyOn(utils, "getEventStatus").mockReturnValue({
      label: "Past",
      classes: "",
    });

    const payload = generateAttendanceQrPayload({ attendeeId, eventId, code });
    const result = await markAttendanceByQrScan({ eventId, qrPayload: payload, ownerUserId });

    expect(result.success).toBe(false);
    expect(result.message).toContain("Event is not live");
  });

  it("returns error if attendee does not belong to the event", async () => {
    vi.spyOn(neonDb, "queryNeonOne")
      .mockResolvedValueOnce({
        id: eventId,
        user_id: ownerUserId,
        date: "2026-08-05",
      }) // Event check
      .mockResolvedValueOnce(null); // Attendee query

    vi.spyOn(utils, "getEventStatus").mockReturnValue({
      label: "Today",
      classes: "",
    });

    const payload = generateAttendanceQrPayload({ attendeeId, eventId, code });
    const result = await markAttendanceByQrScan({ eventId, qrPayload: payload, ownerUserId });

    expect(result.success).toBe(false);
    expect(result.message).toBe("Attendee does not belong to this event.");
  });

  it("marks attendance successfully for eligible scans", async () => {
    vi.spyOn(neonDb, "queryNeonOne")
      .mockResolvedValueOnce({
        id: eventId,
        user_id: ownerUserId,
        date: "2026-08-05",
      }) // Event check
      .mockResolvedValueOnce({
        id: attendeeId,
        event_id: eventId,
        name: "Test Attendee",
        attendance_code: code,
        attended: false,
      }); // Attendee check

    vi.spyOn(utils, "getEventStatus").mockReturnValue({
      label: "Today",
      classes: "",
    });

    vi.spyOn(neonDb, "queryNeon").mockResolvedValueOnce([{ id: attendeeId }]); // Update check

    const payload = generateAttendanceQrPayload({ attendeeId, eventId, code });
    const result = await markAttendanceByQrScan({ eventId, qrPayload: payload, ownerUserId });

    expect(result.success).toBe(true);
    expect(result.attendee?.name).toBe("Test Attendee");
    expect(result.message).toContain("Attendance marked successfully");
  });

  it("rejects duplicates and indicates attendance was already marked", async () => {
    vi.spyOn(neonDb, "queryNeonOne")
      .mockResolvedValueOnce({
        id: eventId,
        user_id: ownerUserId,
        date: "2026-08-05",
      }) // Event check
      .mockResolvedValueOnce({
        id: attendeeId,
        event_id: eventId,
        name: "Test Attendee",
        attendance_code: code,
        attended: true,
      }); // Already marked

    vi.spyOn(utils, "getEventStatus").mockReturnValue({
      label: "Today",
      classes: "",
    });

    const payload = generateAttendanceQrPayload({ attendeeId, eventId, code });
    const result = await markAttendanceByQrScan({ eventId, qrPayload: payload, ownerUserId });

    expect(result.success).toBe(false);
    expect(result.alreadyAttended).toBe(true);
    expect(result.message).toContain("Attendance has already been marked");
  });

  it("marks attendance successfully when scanning a direct badge QR URL", async () => {
    vi.spyOn(neonDb, "queryNeonOne")
      .mockResolvedValueOnce({
        id: eventId,
        user_id: ownerUserId,
        date: "2026-08-05",
      }) // Event check
      .mockResolvedValueOnce({
        id: attendeeId,
        event_id: eventId,
        name: "Badge URL Attendee",
        track: "visitor",
        attended: false,
      }); // Attendee check

    vi.spyOn(utils, "getEventStatus").mockReturnValue({
      label: "Today",
      classes: "",
    });

    vi.spyOn(neonDb, "queryNeon").mockResolvedValueOnce([{ id: attendeeId }]);

    const badgeUrl = `https://linq.avtive.app/cards/${attendeeId}/scan`;
    const result = await markAttendanceByQrScan({ eventId, qrPayload: badgeUrl, ownerUserId });

    expect(result.success).toBe(true);
    expect(result.attendee?.name).toBe("Badge URL Attendee");
    expect(result.message).toContain("Attendance marked successfully");
  });

  it("rejects badge QR URL when attendee belongs to a different event", async () => {
    vi.spyOn(neonDb, "queryNeonOne")
      .mockResolvedValueOnce({
        id: eventId,
        user_id: ownerUserId,
        date: "2026-08-05",
      }) // Event check
      .mockResolvedValueOnce(null); // Attendee not found for this event

    vi.spyOn(utils, "getEventStatus").mockReturnValue({
      label: "Today",
      classes: "",
    });

    const badgeUrl = `https://linq.avtive.app/cards/${attendeeId}/scan`;
    const result = await markAttendanceByQrScan({ eventId, qrPayload: badgeUrl, ownerUserId });

    expect(result.success).toBe(false);
    expect(result.message).toBe("Attendee does not belong to this event.");
  });
});

describe("markAttendeeAttendanceById flow for mobile camera scan", () => {
  const attendeeId = "a2a789f1-098a-40a4-ba41-ad832bb7823c";
  const eventId = "b3b890a2-109b-41b5-8b52-be943cc8934d";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid UUID format gracefully", async () => {
    const result = await markAttendeeAttendanceById("not-a-uuid");
    expect(result.success).toBe(false);
    expect(result.message).toContain("Invalid attendee badge identifier");
  });

  it("rejects when attendee card is not found in database", async () => {
    vi.spyOn(neonDb, "queryNeonOne").mockResolvedValueOnce(null);

    const result = await markAttendeeAttendanceById(attendeeId);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Attendee badge not found");
  });

  it("marks attendance on first scan and resolves LinkedIn profile", async () => {
    const fixedDate = new Date("2026-09-04T10:00:00Z");
    vi.spyOn(neonDb, "queryNeonOne")
      .mockResolvedValueOnce({
        id: attendeeId,
        event_id: eventId,
        event_name: "Tech Summit",
        name: "Alice Smith",
        role: "Engineer",
        company: "Acme Corp",
        track: "visitor",
        linkedin: "alicesmith",
        attended: false,
      }) // Attendee lookup
      .mockResolvedValueOnce({
        id: eventId,
        name: "Tech Summit",
        date: "2026-09-04",
        time: "10:00 AM",
        location: "Hall A",
        logo_url: "https://example.com/logo.png",
      }); // Event lookup

    vi.spyOn(neonDb, "queryNeon").mockResolvedValueOnce([{ id: attendeeId, updated_at: fixedDate }]);

    const result = await markAttendeeAttendanceById(attendeeId);
    expect(result.success).toBe(true);
    expect(result.alreadyAttended).toBe(false);
    expect(result.attendee?.name).toBe("Alice Smith");
    expect(result.attendee?.linkedinUrl).toBe("https://linkedin.com/in/alicesmith");
    expect(result.event?.name).toBe("Tech Summit");
    expect(result.message).toContain("Attendance marked successfully");
  });

  it("detects already attended badge and prevents duplicate attendance recording", async () => {
    const previousTimestamp = new Date("2026-09-04T09:30:00Z");
    vi.spyOn(neonDb, "queryNeonOne")
      .mockResolvedValueOnce({
        id: attendeeId,
        event_id: eventId,
        event_name: "Tech Summit",
        name: "Bob Jones",
        role: "Speaker",
        company: "Dev Co",
        track: "guest",
        linkedin: "https://linkedin.com/in/bobjones",
        attended: true,
        updated_at: previousTimestamp,
      }) // Attendee lookup (already true)
      .mockResolvedValueOnce({
        id: eventId,
        name: "Tech Summit",
        date: "2026-09-04",
        time: "10:00 AM",
        location: "Hall A",
        logo_url: null,
      }); // Event lookup

    const result = await markAttendeeAttendanceById(attendeeId);
    expect(result.success).toBe(true);
    expect(result.alreadyAttended).toBe(true);
    expect(result.message).toContain("Attendance already marked");
    expect(result.attendedAt).toEqual(previousTimestamp);
    expect(result.attendee?.name).toBe("Bob Jones");
    // Ensure no UPDATE query was executed
    expect(neonDb.queryNeon).not.toHaveBeenCalled();
  });
});

describe("LinkedIn URL and QR payload utility functions", () => {
  it("formats LinkedIn handles and URLs consistently", () => {
    expect(formatAttendeeLinkedInUrl("johndoe")).toBe("https://linkedin.com/in/johndoe");
    expect(formatAttendeeLinkedInUrl("linkedin.com/in/johndoe")).toBe("https://linkedin.com/in/johndoe");
    expect(formatAttendeeLinkedInUrl("https://linkedin.com/in/johndoe")).toBe("https://linkedin.com/in/johndoe");
    expect(formatAttendeeLinkedInUrl("https://mywebsite.com")).toBe("https://mywebsite.com");
    expect(formatAttendeeLinkedInUrl("")).toBe("");
    expect(formatAttendeeLinkedInUrl(null)).toBe("");
  });

  it("extracts card IDs from scan URLs and payloads", () => {
    const uuid = "a2a789f1-098a-40a4-ba41-ad832bb7823c";
    expect(extractCardIdFromQrPayload(`https://linq.avtive.app/cards/${uuid}/scan`)).toBe(uuid);
    expect(extractCardIdFromQrPayload(`http://localhost:3000/cards/${uuid}`)).toBe(uuid);
    expect(extractCardIdFromQrPayload(`/cards/${uuid}/scan`)).toBe(uuid);
    expect(extractCardIdFromQrPayload(uuid)).toBe(uuid);
    expect(extractCardIdFromQrPayload("invalid-payload")).toBe(null);
  });
});
