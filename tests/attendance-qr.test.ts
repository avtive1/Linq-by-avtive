import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  generateAttendanceQrPayload,
  parseAndVerifyAttendanceQrPayload,
  computeAttendanceHmac,
} from "@/lib/security/attendance-qr";
import { markAttendanceByQrScan } from "@/lib/services/attendance.service";
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
  const attendeeId = "11111111-1111-1111-1111-111111111111";
  const eventId = "22222222-2222-2222-2222-222222222222";
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
  const attendeeId = "11111111-1111-1111-1111-111111111111";
  const eventId = "22222222-2222-2222-2222-222222222222";
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
});
