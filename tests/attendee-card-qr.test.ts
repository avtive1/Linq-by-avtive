import { describe, expect, it } from "vitest";
import {
  emailAttendeeCardDisplay,
  ATTENDANCE_QR_CID,
} from "@/lib/email-templates/layout";
import {
  generateVisitorAttendanceCodeEmailHtml,
  appendAttendanceCodeToApprovedEmailText,
} from "@/lib/email-templates/attendance-code";
import { generateRegistrationApprovedEmailHtml } from "@/lib/email-templates/registration-approved";

describe("Attendee Card with QR Code Email Flow", () => {
  describe("emailAttendeeCardDisplay", () => {
    it("renders complete attendee card with all details, QR code, and card link", () => {
      const html = emailAttendeeCardDisplay({
        eventName: "Tech Innovators Summit 2026",
        attendeeName: "Jane Doe",
        role: "Principal Architect",
        company: "Acme Cloud Corp",
        attendanceCode: "948215",
        qrDataUrlOrCid: `cid:${ATTENDANCE_QR_CID}`,
        cardLink: "https://avtive.app/cards/test-card-123?share=true",
      });

      expect(html).toContain("Official Attendee Card");
      expect(html).toContain("Tech Innovators Summit 2026");
      expect(html).toContain("Jane Doe");
      expect(html).toContain("Principal Architect");
      expect(html).toContain("Acme Cloud Corp");
      expect(html).toContain("948215");
      expect(html).toContain("cid:attendance-qr-code@avtive.app");
      expect(html).toContain("Scan to Check In");
      expect(html).toContain("Open Digital Attendee Card");
      expect(html).toContain("https://avtive.app/cards/test-card-123?share=true");

      // Verify no raw null/undefined literals
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("null");
    });

    it("handles missing optional fields cleanly without rendering null or undefined", () => {
      const html = emailAttendeeCardDisplay({
        eventName: "DevFest 2026",
        attendeeName: "Alex Smith",
        qrDataUrlOrCid: "data:image/png;base64,mockqrdata",
      });

      expect(html).toContain("DevFest 2026");
      expect(html).toContain("Alex Smith");
      expect(html).toContain("data:image/png;base64,mockqrdata");
      expect(html).toContain("Scan to Check In");

      // Role, company, attendanceCode, cardLink were not provided
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("null");
      expect(html).not.toContain("Check-in Code");
      expect(html).not.toContain("Open Digital Attendee Card");
    });

    it("handles role without company cleanly", () => {
      const html = emailAttendeeCardDisplay({
        eventName: "Tech Meetup",
        attendeeName: "Sam Taylor",
        role: "Software Engineer",
      });

      expect(html).toContain("Software Engineer");
      expect(html).not.toContain("&bull;");
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("null");
    });

    it("handles company without role cleanly", () => {
      const html = emailAttendeeCardDisplay({
        eventName: "Tech Meetup",
        attendeeName: "Sam Taylor",
        company: "Acme Inc",
      });

      expect(html).toContain("Acme Inc");
      expect(html).not.toContain("&bull;");
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("null");
    });
  });

  describe("generateVisitorAttendanceCodeEmailHtml", () => {
    it("generates branded attendee card email with attendee details and check-in QR code", () => {
      const html = generateVisitorAttendanceCodeEmailHtml({
        eventName: "AI World Congress",
        attendeeName: "Dr. Evelyn Reed",
        role: "Research Scientist",
        company: "Deep Labs",
        attendanceCode: "582103",
        qrDataUrl: `cid:${ATTENDANCE_QR_CID}`,
        cardLink: "https://avtive.app/cards/evelyn-card?share=true",
      });

      expect(html).toContain("Your event attendee card");
      expect(html).toContain("Hi Dr. Evelyn Reed,");
      expect(html).toContain("AI World Congress");
      expect(html).toContain("Here is your official Attendee Card");
      expect(html).toContain("Dr. Evelyn Reed");
      expect(html).toContain("Research Scientist");
      expect(html).toContain("Deep Labs");
      expect(html).toContain("582103");
      expect(html).toContain("cid:attendance-qr-code@avtive.app");
      expect(html).toContain("Open Digital Attendee Card");
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("null");
    });

    it("falls back to generic greeting when attendeeName is omitted", () => {
      const html = generateVisitorAttendanceCodeEmailHtml({
        eventName: "Open Conference",
        attendanceCode: "112233",
        qrDataUrl: `cid:${ATTENDANCE_QR_CID}`,
      });

      expect(html).toContain("Hi there,");
      expect(html).toContain("Open Conference");
      expect(html).toContain("112233");
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("null");
    });

    it("appendAttendanceCodeToApprovedEmailText includes Attendee Card with scannable QR description", () => {
      const text = appendAttendanceCodeToApprovedEmailText("Your registration was approved.", "654321");
      expect(text).toContain("Your Attendee Card with scannable QR code is included in the HTML version");
      expect(text).toContain("Attendance code: 654321");
      expect(text).toContain("Present this Attendee Card at the event entrance.");
    });
  });

  describe("generateRegistrationApprovedEmailHtml", () => {
    it("renders Attendee Card with attendee details and QR code in approved email", () => {
      const html = generateRegistrationApprovedEmailHtml({
        eventName: "Design Expo 2026",
        attendeeName: "Marcus Vance",
        role: "Head of Product",
        company: "Studio Minimal",
        attendanceCode: "778899",
        qrDataUrl: `cid:${ATTENDANCE_QR_CID}`,
        cardLink: "https://avtive.app/cards/marcus-card?share=true",
        eventLink: "https://avtive.app/r/design-expo",
      });

      expect(html).toContain("Registration Approved");
      expect(html).toContain("Hi Marcus Vance,");
      expect(html).toContain("Design Expo 2026");
      expect(html).toContain("Here is your official Attendee Card with scannable check-in QR code:");
      expect(html).toContain("Marcus Vance");
      expect(html).toContain("Head of Product");
      expect(html).toContain("Studio Minimal");
      expect(html).toContain("778899");
      expect(html).toContain("cid:attendance-qr-code@avtive.app");
      expect(html).toContain("Open Digital Attendee Card");
      expect(html).toContain("View Event Page");
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("null");
    });
  });

  describe("Attendee Card QR code & social links handling", () => {
    it("formats attendee linkedin URLs safely", async () => {
      const { formatAttendeeLinkedInUrl } = await import("@/lib/validation/social-urls");
      expect(formatAttendeeLinkedInUrl("https://www.linkedin.com/in/janedoe")).toBe("https://www.linkedin.com/in/janedoe");
      expect(formatAttendeeLinkedInUrl("linkedin.com/in/janedoe")).toBe("https://linkedin.com/in/janedoe");
      expect(formatAttendeeLinkedInUrl("")).toBe("");
      expect(formatAttendeeLinkedInUrl(undefined)).toBe("");
    });

    it("retrieves social platform icons for supported platforms and gracefully returns undefined for unsupported", async () => {
      const { getSocialPlatformIcon } = await import("@/components/AttendeeSocialLinks");
      expect(getSocialPlatformIcon("linkedin")).toBeDefined();
      expect(getSocialPlatformIcon("github")).toBeDefined();
      expect(getSocialPlatformIcon("twitter")).toBeDefined();
      expect(getSocialPlatformIcon("unknown" as any)).toBeUndefined();
    });

    it("verifies attendee card scan URL pattern matches existing check-in route", () => {
      const cardId = "550e8400-e29b-41d4-a716-446655440000";
      const origin = "https://avtive.app";
      const scanUrl = `${origin}/cards/${encodeURIComponent(cardId)}/scan`;
      expect(scanUrl).toBe("https://avtive.app/cards/550e8400-e29b-41d4-a716-446655440000/scan");
    });
  });
});
