import { NextRequest, NextResponse } from "next/server";
import { getServerAuthSession } from "@/auth";
import {
  analyzeEmailSpamScore,
  getLeadDatabaseAudience,
  sendPromotionalCampaign,
  type RecipientLead,
} from "@/lib/promotions/campaign-sender";
import { EMAIL_TEMPLATES } from "@/lib/promotions/templates";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      templateId = "product_launch",
      subject,
      headline,
      subheadline,
      bodyText,
      ctaText,
      ctaUrl,
      promoCode,
      themeColor = "#7c3aed",
      bulletPoints,
      discountBadge,
      audienceType = "all_leads",
      eventId,
      manualEmails,
      isTestSend = false,
      testEmail,
      senderName,
      organizationName,
    } = body;

    if (!subject || !bodyText) {
      return NextResponse.json({ error: "Subject and body content are required." }, { status: 400 });
    }

    // Deliverability & spam score pre-flight check
    const spamAnalysis = analyzeEmailSpamScore(subject, bodyText);

    // Pick and render template
    const templateDef = EMAIL_TEMPLATES.find((t) => t.id === templateId) || EMAIL_TEMPLATES[0];
    const rendered = templateDef.render({
      organizationName: organizationName || "Linq by Avtive",
      headline: headline || subject,
      subheadline,
      bodyText,
      ctaText,
      ctaUrl,
      promoCode,
      discountBadge,
      bulletPoints: Array.isArray(bulletPoints) ? bulletPoints : undefined,
      themeColor,
    });

    // Prepare recipients list
    let recipients: RecipientLead[] = [];
    const leadMap = new Map<string, RecipientLead>();

    if (isTestSend) {
      const emailToSend = (testEmail || session.user.email || "").trim();
      if (!emailToSend || !emailToSend.includes("@")) {
        return NextResponse.json({ error: "Valid test recipient email is required." }, { status: 400 });
      }
      recipients = [
        {
          email: emailToSend,
          name: session.user.name || "Test Recipient",
          company: organizationName || "Linq",
          source: "manual",
        },
      ];
    } else if (audienceType === "manual" && manualEmails) {
      const emailList: string[] = typeof manualEmails === "string"
        ? manualEmails.split(/[\n,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@"))
        : Array.isArray(manualEmails) ? manualEmails.map((e) => String(e).trim().toLowerCase()).filter((e) => e.includes("@")) : [];

      recipients = Array.from(new Set(emailList)).map((email) => ({
        email,
        source: "manual",
      }));
    } else {
      // 1. Ingest directRecipients if provided from the client
      const directList = Array.isArray(body.directRecipients) ? body.directRecipients : [];
      for (const item of directList) {
        const rawEmail = typeof item === "string" ? item.trim().toLowerCase() : String(item?.email || "").trim().toLowerCase();
        if (rawEmail && rawEmail.includes("@") && !leadMap.has(rawEmail)) {
          leadMap.set(rawEmail, {
            email: rawEmail,
            name: typeof item === "object" && item?.name ? String(item.name) : undefined,
            company: typeof item === "object" && item?.company ? String(item.company) : undefined,
            source: "attendee",
          });
        }
      }

      // 2. Query lead database (attendees / registration_requests / profiles)
      const dbLeads = await getLeadDatabaseAudience({
        eventId: audienceType === "event" ? eventId : undefined,
        limit: 1000,
      });

      for (const lead of dbLeads) {
        const key = lead.email.trim().toLowerCase();
        if (!leadMap.has(key)) {
          leadMap.set(key, lead);
        }
      }

      recipients = Array.from(leadMap.values());
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No valid lead recipients found for the selected audience. Please ensure at least one lead has a valid email address." },
        { status: 400 },
      );
    }

    // Dispatch campaign
    const sendResult = await sendPromotionalCampaign({
      senderName: senderName || organizationName || "Linq by Avtive",
      organizationName: organizationName || "Linq by Avtive",
      subject,
      htmlContent: rendered.html,
      textContent: rendered.text,
      recipients,
      isTestSend,
    });

    return NextResponse.json({
      success: true,
      result: sendResult,
      spamAnalysis,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to dispatch campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
