import { describe, expect, it, vi, beforeEach } from "vitest";
import { createAttendeeCardFromPayload } from "@/lib/services/event.service";
import { createRegistrationRequest } from "@/lib/services/registration.service";
import { markAttendeeAttendanceById } from "@/lib/services/attendance.service";
import { decryptAttendeeSensitiveFields } from "@/lib/security/attendee-sensitive";
import * as neonDb from "@/lib/neon-db";

vi.mock("@/lib/neon-db", () => ({
  queryNeon: vi.fn(),
  queryNeonOne: vi.fn(),
  insertRow: vi.fn(),
  updateRows: vi.fn(),
  runWithRlsBypassAsync: vi.fn(async (cb) => cb()),
}));

describe("Attendee Registration with Mandatory LinkedIn & Social Links", () => {
  const eventId = "b3b890a2-109b-41b5-8b52-be943cc8934d";
  const mockEvent = {
    id: eventId,
    name: "Tech Summit 2026",
    user_id: "organizer-user-id",
    organization_id: "org-123",
    date: "2026-10-10",
    time: "10:00 AM",
    location: "Auditorium",
    capacity: 500,
    attendee_count: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Event Card Creation Service (createAttendeeCardFromPayload)", () => {
    it("fails when LinkedIn URL is missing for public registration", async () => {
      await expect(
        createAttendeeCardFromPayload({
          payload: {
            name: "Jane Developer",
            role: "Software Engineer",
            company: "Acme Corp",
            email: "jane@example.com",
            event_id: eventId,
            linkedin: "",
          },
          authUserId: null,
          forcePublicRegistration: true,
        }),
      ).rejects.toThrow("LinkedIn");

      expect(neonDb.insertRow).not.toHaveBeenCalled();
    });

    it("fails when LinkedIn URL is a dangerous script URL", async () => {
      await expect(
        createAttendeeCardFromPayload({
          payload: {
            name: "Jane Developer",
            role: "Software Engineer",
            company: "Acme Corp",
            email: "jane@example.com",
            event_id: eventId,
            linkedin: "javascript:alert(1)",
          },
          authUserId: null,
          forcePublicRegistration: true,
        }),
      ).rejects.toThrow("Dangerous or invalid URL protocol rejected.");

      expect(neonDb.insertRow).not.toHaveBeenCalled();
    });

    it("fails when LinkedIn URL has an unapproved domain", async () => {
      await expect(
        createAttendeeCardFromPayload({
          payload: {
            name: "Jane Developer",
            role: "Software Engineer",
            company: "Acme Corp",
            email: "jane@example.com",
            event_id: eventId,
            linkedin: "https://attacker.site/in/jane",
          },
          authUserId: null,
          forcePublicRegistration: true,
        }),
      ).rejects.toThrow("URL must be on linkedin.com.");

      expect(neonDb.insertRow).not.toHaveBeenCalled();
    });

    it("successfully creates attendee card with valid LinkedIn and stores normalized URL", async () => {
      vi.mocked(neonDb.queryNeonOne).mockResolvedValueOnce({
        card_color: "purple",
        card_font: "inter",
      });
      vi.mocked(neonDb.insertRow).mockResolvedValueOnce({
        id: "22222222-3333-4444-9555-666666666666",
        event_id: eventId,
        name: "Jane Developer",
      });

      const result = await createAttendeeCardFromPayload({
        payload: {
          name: "Jane Developer",
          role: "Software Engineer",
          company: "Acme Corp",
          email: "jane@example.com",
          event_id: eventId,
          linkedin: "linkedin.com/in/janedev",
        },
        authUserId: null,
        forcePublicRegistration: true,
      });

      expect(result.data).toBeDefined();
      expect(neonDb.insertRow).toHaveBeenCalledTimes(1);
      const insertedPayload = vi.mocked(neonDb.insertRow).mock.calls[0][1];
      const { row } = decryptAttendeeSensitiveFields(insertedPayload as any);
      expect(row.linkedin).toBe("https://www.linkedin.com/in/janedev");
    });

    it("validates and embeds optional social links in custom_fields.social_links", async () => {
      vi.mocked(neonDb.queryNeonOne).mockResolvedValueOnce({
        card_color: "purple",
        card_font: "inter",
      });
      vi.mocked(neonDb.insertRow).mockResolvedValueOnce({
        id: "33333333-4444-4555-8666-777777777777",
        event_id: eventId,
        name: "Alex Dev",
      });

      const result = await createAttendeeCardFromPayload({
        payload: {
          name: "Alex Dev",
          role: "Product Designer",
          company: "DesignCo",
          email: "alex@example.com",
          event_id: eventId,
          linkedin: "https://www.linkedin.com/in/alexdev",
          social_links: {
            github: "github.com/alexdev",
            twitter: "@alexdesigner",
            instagram: "@alex.design",
            website: "https://alex.portfolio",
          },
        },
        authUserId: null,
        forcePublicRegistration: true,
      });

      expect(result.data).toBeDefined();
      expect(neonDb.insertRow).toHaveBeenCalledTimes(1);
      const insertedPayload = vi.mocked(neonDb.insertRow).mock.calls[0][1];
      const { row } = decryptAttendeeSensitiveFields(insertedPayload as any);

      // Top-level social_links must be deleted so raw Postgres column does not error
      expect(row.social_links).toBeUndefined();

      // custom_fields must contain validated and normalized social_links
      const customFields = row.custom_fields as Record<string, any>;
      expect(customFields).toBeDefined();
      expect(customFields.social_links).toBeDefined();
      expect(customFields.social_links.github).toBe("https://github.com/alexdev");
      expect(customFields.social_links.twitter).toBe("https://x.com/alexdesigner");
      expect(customFields.social_links.instagram).toBe("https://www.instagram.com/alex.design");
      expect(customFields.social_links.website).toBe("https://alex.portfolio");
    });

    it("rejects invalid platform URLs inside social_links", async () => {
      await expect(
        createAttendeeCardFromPayload({
          payload: {
            name: "Alex Dev",
            role: "Product Designer",
            company: "DesignCo",
            email: "alex@example.com",
            event_id: eventId,
            linkedin: "https://www.linkedin.com/in/alexdev",
            social_links: {
              github: "https://fakegithub.com/user",
            },
          },
          authUserId: null,
          forcePublicRegistration: true,
        }),
      ).rejects.toThrow("URL must be on github.com.");

      expect(neonDb.insertRow).not.toHaveBeenCalled();
    });
  });

  describe("Moderated Registration Service (createRegistrationRequest)", () => {
    it("fails registration request when LinkedIn is missing", async () => {
      vi.mocked(neonDb.queryNeonOne).mockResolvedValueOnce(mockEvent);

      await expect(
        createRegistrationRequest({
          eventId,
          userId: null,
          attendeeData: {
            name: "Guest Speaker",
            role: "Keynote",
            company: "Keynote Corp",
            card_email: "speaker@example.com",
            track: "guest",
            linkedin: "",
          },
        }),
      ).rejects.toThrow("LinkedIn");

      expect(neonDb.insertRow).not.toHaveBeenCalled();
    });

    it("persists normalized LinkedIn and social_links in guest registration request", async () => {
      vi.mocked(neonDb.queryNeonOne).mockResolvedValueOnce(mockEvent);
      vi.mocked(neonDb.insertRow).mockResolvedValueOnce({
        id: "44444444-5555-4666-8777-888888888888",
        event_id: eventId,
        name: "Guest Speaker",
        status: "PENDING",
      });

      const result = await createRegistrationRequest({
        eventId,
        userId: null,
        attendeeData: {
          name: "Guest Speaker",
          role: "Keynote",
          company: "Keynote Corp",
          card_email: "speaker@example.com",
          track: "guest",
          linkedin: "linkedin.com/in/keynotespeaker",
          social_links: {
            github: "keynote",
            youtube: "https://youtube.com/@keynotespeaker",
          },
        },
      });

      expect(result).toBeDefined();
      expect(neonDb.insertRow).toHaveBeenCalledTimes(1);
      const insertedRow = vi.mocked(neonDb.insertRow).mock.calls[0][1];
      expect(insertedRow.event_id).toBe(eventId);
      expect(insertedRow.status).toBe("PENDING");

      const { row } = decryptAttendeeSensitiveFields(insertedRow.attendee_payload as Record<string, unknown>);
      expect(row.linkedin).toBe("https://www.linkedin.com/in/keynotespeaker");
      expect(row.social_links).toBeUndefined();
      const customFields = row.custom_fields as Record<string, any>;
      expect(customFields?.social_links?.github).toBe("https://github.com/keynote");
      expect(customFields?.social_links?.youtube).toBe("https://www.youtube.com/@keynotespeaker");
    });
  });

  describe("Scan Attendance Check-in with Social Links", () => {
    it("returns socialLinks alongside linkedinUrl upon check-in", async () => {
      const attendeeId = "a2a789f1-098a-40a4-ba41-ad832bb7823c";
      vi.mocked(neonDb.queryNeonOne)
        .mockResolvedValueOnce({
          id: attendeeId,
          event_id: eventId,
          name: "Checked-in Attendee",
          role: "Developer",
          company: "Tech Co",
          linkedin: "https://www.linkedin.com/in/checkedin",
          attended: false,
          attended_at: null,
          photo_url: null,
          track: "visitor",
          custom_fields: {
            social_links: {
              github: "https://github.com/checkedin",
              twitter: "https://x.com/checkedin",
            },
          },
        })
        .mockResolvedValueOnce(mockEvent);

      vi.mocked(neonDb.queryNeon).mockResolvedValueOnce([
        { id: attendeeId, updated_at: new Date() },
      ]);

      const res = await markAttendeeAttendanceById(attendeeId);

      expect(res.success).toBe(true);
      expect(res.attendee?.linkedinUrl).toBe("https://www.linkedin.com/in/checkedin");
      expect(res.attendee?.socialLinks).toEqual({
        github: "https://github.com/checkedin",
        twitter: "https://x.com/checkedin",
      });
    });
  });
});
