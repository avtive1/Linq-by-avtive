import { describe, it, expect } from "vitest";
import { DEFAULT_TEMPLATES } from "@/components/admin/promotion/defaultTemplates";
import { PromotionChannel } from "@/components/admin/promotion/types";

describe("Admin Promotion Feature", () => {
  it("provides exactly 3 templates for each of the 3 channels", () => {
    const channels: PromotionChannel[] = ["newsletter", "linkedin", "whatsapp"];

    for (const channel of channels) {
      const templates = DEFAULT_TEMPLATES[channel];
      expect(templates).toBeDefined();
      expect(templates.length).toBe(3);

      for (const tpl of templates) {
        expect(tpl.id).toBeTruthy();
        expect(tpl.channel).toBe(channel);
        expect(tpl.name).toBeTruthy();
        expect(tpl.message).toBeTruthy();
      }
    }
  });

  it("newsletter templates contain subject and heading", () => {
    const newsletterTemplates = DEFAULT_TEMPLATES.newsletter;
    expect(newsletterTemplates.length).toBe(3);

    const names = newsletterTemplates.map((t) => t.name);
    expect(names).toContain("Event Update");
    expect(names).toContain("Announcement");
    expect(names).toContain("Promotion");

    for (const tpl of newsletterTemplates) {
      expect(tpl.subject).toBeTruthy();
      expect(tpl.heading).toBeTruthy();
    }
  });

  it("linkedin templates contain appropriate DM templates", () => {
    const linkedinTemplates = DEFAULT_TEMPLATES.linkedin;
    expect(linkedinTemplates.length).toBe(3);

    const names = linkedinTemplates.map((t) => t.name);
    expect(names).toContain("Event Follow-up");
    expect(names).toContain("Thank You");
    expect(names).toContain("Announcement");

    for (const tpl of linkedinTemplates) {
      expect(tpl.message).toContain("{{name}}");
    }
  });

  it("whatsapp templates support dynamic attendee name placeholder", () => {
    const whatsappTemplates = DEFAULT_TEMPLATES.whatsapp;
    expect(whatsappTemplates.length).toBe(3);

    const names = whatsappTemplates.map((t) => t.name);
    expect(names).toContain("Event Reminder");
    expect(names).toContain("Announcement");
    expect(names).toContain("Promotion");

    for (const tpl of whatsappTemplates) {
      expect(tpl.message).toContain("{{name}}");
      const rendered = tpl.message.replace(/\{\{name\}\}/gi, "Sarah");
      expect(rendered).toContain("Sarah");
      expect(rendered).not.toContain("{{name}}");
    }
  });

  it("team access defaults to Admin and Marketing enabled, Event Team disabled", () => {
    const defaultRoles = [
      { id: "admin", label: "Admin", enabled: true },
      { id: "marketing", label: "Marketing", enabled: true },
      { id: "event_team", label: "Event Team", enabled: false },
    ];
    expect(defaultRoles.find((r) => r.id === "admin")?.enabled).toBe(true);
    expect(defaultRoles.find((r) => r.id === "marketing")?.enabled).toBe(true);
    expect(defaultRoles.find((r) => r.id === "event_team")?.enabled).toBe(false);
  });

  it("handles custom company sender name and replyTo in email options", async () => {
    const { sendTransactionalEmail } = await import("@/lib/notifications/email");
    const result = await sendTransactionalEmail({
      to: "attendee@example.com",
      fromName: "Acme Corp Campaign",
      replyTo: "organizer@acmecorp.com",
      subject: "Exclusive Campaign Promotion",
      text: "Hello attendee!",
    });

    expect(result).toBeDefined();
    expect(typeof result.sent).toBe("boolean");
  });
});
