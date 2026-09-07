import { escapeHtml } from "@/lib/email-templates/layout";

export interface PromotionTemplateOptions {
  organizationName?: string;
  organizationLogoUrl?: string;
  headline: string;
  subheadline?: string;
  bodyText: string;
  ctaText?: string;
  ctaUrl?: string;
  featuredImageUrl?: string;
  bulletPoints?: string[];
  promoCode?: string;
  discountBadge?: string;
  recipientName?: string;
  unsubscribeUrl?: string;
  themeColor?: string;
}

export interface EmailTemplateDefinition {
  id: string;
  name: string;
  category: "launch" | "event" | "announcement" | "offer" | "newsletter";
  description: string;
  defaultSubject: string;
  defaultHeadline: string;
  defaultBody: string;
  defaultCtaText: string;
  defaultCtaUrl: string;
  defaultBadge?: string;
  defaultBullets?: string[];
  render: (options: PromotionTemplateOptions) => { subject: string; html: string; text: string };
}

function renderEmailShell(contentHtml: string, options: PromotionTemplateOptions): string {
  const brandName = escapeHtml(options.organizationName || "Linq by Avtive");
  const logoUrl = options.organizationLogoUrl || "https://linq.avtive.app/linq-logo.png";
  const primaryColor = options.themeColor || "#7c3aed";
  const unsubUrl = options.unsubscribeUrl || "https://linq.avtive.app/unsubscribe";

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(options.headline)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: auto !important; }
      .fluid { max-width: 100% !important; height: auto !important; margin-left: auto !important; margin-right: auto !important; }
      .mobile-padding { padding: 24px 20px !important; }
      .mobile-h1 { font-size: 26px !important; line-height: 1.25 !important; }
      .mobile-btn { display: block !important; width: 100% !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <div style="display: none; font-size: 1px; color: #f8fafc; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${escapeHtml(options.subheadline || options.headline)}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <!-- Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header Bar with Logo -->
          <tr>
            <td align="center" style="padding: 32px 32px 24px; border-bottom: 1px solid #f1f5f9; background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <img src="${escapeHtml(logoUrl)}" alt="${brandName}" width="120" style="max-height: 38px; width: auto; display: block; border: 0;" />
                  </td>
                  ${options.discountBadge ? `
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; background-color: #f3e8ff; color: #6b21a8; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 12px; border-radius: 9999px; border: 1px solid #e9d5ff;">
                      ${escapeHtml(options.discountBadge)}
                    </span>
                  </td>
                  ` : ""}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Slot -->
          <tr>
            <td class="mobile-padding" style="padding: 36px 36px 32px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer & Unsubscribe Compliance (RFC 8058 & Anti-Spam compliant) -->
          <tr>
            <td style="padding: 28px 36px 36px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="font-size: 13px; line-height: 1.6; color: #64748b;">
                    <p style="margin: 0 0 10px; font-weight: 600; color: #334155;">
                      Sent with Linq by Avtive
                    </p>
                    <p style="margin: 0 0 14px; font-size: 12px; color: #94a3b8;">
                      You are receiving this promotional update because you engaged with ${brandName} or joined our network.
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                      <a href="${escapeHtml(unsubUrl)}" style="color: #64748b; text-decoration: underline;">Unsubscribe immediately</a>
                      &nbsp;&bull;&nbsp;
                      <a href="https://avtive.app/privacy" style="color: #64748b; text-decoration: underline;">Privacy Policy</a>
                      &nbsp;&bull;&nbsp;
                      <a href="https://linq.avtive.app" style="color: #64748b; text-decoration: underline;">Manage Preferences</a>
                    </p>
                    <p style="margin: 12px 0 0; font-size: 11px; color: #cbd5e1;">
                      Linq Platform &bull; Avtive Technologies Inc. &bull; Secure Outbox Delivery
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const EMAIL_TEMPLATES: EmailTemplateDefinition[] = [
  {
    id: "product_launch",
    name: "VIP Product & Feature Launch",
    category: "launch",
    description: "High-impact announcement featuring bold typography, gradient badges, feature bullets, and prominent CTA.",
    defaultSubject: "🚀 Introducing our latest breakthrough: Designed for you",
    defaultHeadline: "Experience the next evolution of Linq",
    defaultBody: "We're thrilled to introduce our newest capabilities engineered to transform how you connect, showcase your credentials, and turn engagement into high-value relationships.",
    defaultCtaText: "Explore What's New",
    defaultCtaUrl: "https://linq.avtive.app/dashboard",
    defaultBadge: "✨ NEW RELEASE",
    defaultBullets: [
      "Ultra-fast attendee card exchange with instant LinkedIn sync",
      "Enterprise command layer for real-time engagement analytics",
      "Automated lead capture with zero friction",
    ],
    render: (opts) => {
      const primary = opts.themeColor || "#7c3aed";
      const html = `
        <div style="text-align: left;">
          <h1 class="mobile-h1" style="margin: 0 0 16px; font-size: 28px; line-height: 1.25; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">
            ${escapeHtml(opts.headline)}
          </h1>
          ${opts.subheadline ? `
            <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.5; color: #475569; font-weight: 500;">
              ${escapeHtml(opts.subheadline)}
            </p>
          ` : ""}
          <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.65; color: #334155;">
            ${escapeHtml(opts.bodyText)}
          </p>

          ${opts.bulletPoints && opts.bulletPoints.length > 0 ? `
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 28px; background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 18px 20px;">
              ${opts.bulletPoints.map((pt) => `
                <tr>
                  <td style="padding: 6px 0; vertical-align: top; width: 24px; color: ${primary}; font-size: 16px;">✦</td>
                  <td style="padding: 6px 0; font-size: 14px; line-height: 1.5; color: #3b0764; font-weight: 500;">${escapeHtml(pt)}</td>
                </tr>
              `).join("")}
            </table>
          ` : ""}

          ${opts.ctaText && opts.ctaUrl ? `
            <div style="margin: 32px 0 16px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: ${primary};">
                    <a href="${escapeHtml(opts.ctaUrl)}" class="mobile-btn" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px; letter-spacing: 0.01em;">
                      ${escapeHtml(opts.ctaText)} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </div>
          ` : ""}
        </div>
      `;

      return {
        subject: opts.headline,
        html: renderEmailShell(html, opts),
        text: `${opts.headline}\n\n${opts.bodyText}\n\n${(opts.bulletPoints || []).join("\n")}\n\n${opts.ctaText}: ${opts.ctaUrl}\n\nUnsubscribe: ${opts.unsubscribeUrl || "https://linq.avtive.app/unsubscribe"}`,
      };
    },
  },
  {
    id: "exclusive_offer",
    name: "Exclusive Lead Offer & Promo Code",
    category: "offer",
    description: "Conversion-focused promotional email with high-contrast discount banner, coupon code box, and urgency countdown note.",
    defaultSubject: "🎁 Special Invitation: Claim your exclusive partner advantage",
    defaultHeadline: "An Exclusive Offer for Our Valued Network",
    defaultBody: "As a recognized leader in our community, we're extending an exclusive promotion designed to give you priority access and premium platform benefits.",
    defaultCtaText: "Claim Your Offer Now",
    defaultCtaUrl: "https://linq.avtive.app/dashboard",
    defaultBadge: "🔥 LIMITED TIME",
    render: (opts) => {
      const primary = opts.themeColor || "#0284c7";
      const promoCode = opts.promoCode || "LINQVIP2026";

      const html = `
        <div style="text-align: center;">
          <h1 class="mobile-h1" style="margin: 0 0 16px; font-size: 28px; line-height: 1.25; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">
            ${escapeHtml(opts.headline)}
          </h1>
          <p style="margin: 0 0 28px; font-size: 15px; line-height: 1.65; color: #475569; max-width: 480px; margin-left: auto; margin-right: auto;">
            ${escapeHtml(opts.bodyText)}
          </p>

          <!-- Promo Code Card -->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 28px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px dashed #38bdf8; border-radius: 12px; text-align: center;">
            <tr>
              <td style="padding: 24px 20px;">
                <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #0369a1;">Use Exclusive Promo Code</p>
                <p style="margin: 0 0 8px; font-size: 28px; font-weight: 900; letter-spacing: 0.15em; font-family: monospace; color: #0c4a6e;">${escapeHtml(promoCode)}</p>
                <p style="margin: 0; font-size: 12px; color: #0284c7;">Valid for upcoming campaign registrations & team access</p>
              </td>
            </tr>
          </table>

          ${opts.ctaText && opts.ctaUrl ? `
            <div style="margin: 28px 0 16px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: ${primary};">
                    <a href="${escapeHtml(opts.ctaUrl)}" class="mobile-btn" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px;">
                      ${escapeHtml(opts.ctaText)} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </div>
          ` : ""}
        </div>
      `;

      return {
        subject: opts.headline,
        html: renderEmailShell(html, opts),
        text: `${opts.headline}\n\n${opts.bodyText}\n\nPromo Code: ${promoCode}\n\n${opts.ctaText}: ${opts.ctaUrl}\n\nUnsubscribe: ${opts.unsubscribeUrl || "https://linq.avtive.app/unsubscribe"}`,
      };
    },
  },
  {
    id: "event_invitation",
    name: "VIP Event & Digital Badge Invitation",
    category: "event",
    description: "Tailored for upcoming summits, conferences, or exclusive corporate networking webinars.",
    defaultSubject: "🎟️ You are invited: Join our upcoming executive showcase",
    defaultHeadline: "You're Officially Invited to Connect",
    defaultBody: "We'd love to have you join our upcoming showcase. Connect with industry pioneers, claim your verified digital card, and exchange credentials effortlessly.",
    defaultCtaText: "Reserve Your VIP Pass",
    defaultCtaUrl: "https://linq.avtive.app",
    defaultBadge: "🎟️ INVITATION",
    render: (opts) => {
      const primary = opts.themeColor || "#059669";
      const html = `
        <div style="text-align: left;">
          <h1 class="mobile-h1" style="margin: 0 0 16px; font-size: 28px; line-height: 1.25; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">
            ${escapeHtml(opts.headline)}
          </h1>
          <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.65; color: #334155;">
            ${escapeHtml(opts.bodyText)}
          </p>

          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 28px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px;">
            <tr>
              <td style="padding: 4px 0; font-size: 14px; color: #065f46; font-weight: 600;">
                📅 <strong>Interactive Sessions:</strong> Live networking & attendee showcase
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0 4px; font-size: 14px; color: #065f46; font-weight: 600;">
                🪪 <strong>Personalized Badge:</strong> Instant one-tap LinkedIn card generation
              </td>
            </tr>
          </table>

          ${opts.ctaText && opts.ctaUrl ? `
            <div style="margin: 32px 0 16px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: ${primary};">
                    <a href="${escapeHtml(opts.ctaUrl)}" class="mobile-btn" target="_blank" style="display: inline-block; padding: 14px 34px; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px;">
                      ${escapeHtml(opts.ctaText)} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </div>
          ` : ""}
        </div>
      `;

      return {
        subject: opts.headline,
        html: renderEmailShell(html, opts),
        text: `${opts.headline}\n\n${opts.bodyText}\n\n${opts.ctaText}: ${opts.ctaUrl}\n\nUnsubscribe: ${opts.unsubscribeUrl || "https://linq.avtive.app/unsubscribe"}`,
      };
    },
  },
  {
    id: "special_announcement",
    name: "Corporate & Organization Spotlight",
    category: "announcement",
    description: "Clean editorial layout for major company milestones, leadership notes, and community updates.",
    defaultSubject: "📢 Important update from the Linq leadership team",
    defaultHeadline: "A Milestone Update for Our Network",
    defaultBody: "Today marks an exciting chapter as we expand our digital ecosystem. We want to share what this means for your organization and how to make the most of our newest tools.",
    defaultCtaText: "Read Full Announcement",
    defaultCtaUrl: "https://linq.avtive.app",
    defaultBadge: "📢 ANNOUNCEMENT",
    render: (opts) => {
      const primary = opts.themeColor || "#1e293b";
      const html = `
        <div style="text-align: left;">
          <h1 class="mobile-h1" style="margin: 0 0 16px; font-size: 28px; line-height: 1.25; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">
            ${escapeHtml(opts.headline)}
          </h1>
          <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: #334155;">
            ${escapeHtml(opts.bodyText)}
          </p>

          ${opts.ctaText && opts.ctaUrl ? `
            <div style="margin: 28px 0 16px;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: ${primary};">
                    <a href="${escapeHtml(opts.ctaUrl)}" class="mobile-btn" target="_blank" style="display: inline-block; padding: 13px 28px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px;">
                      ${escapeHtml(opts.ctaText)} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </div>
          ` : ""}
        </div>
      `;

      return {
        subject: opts.headline,
        html: renderEmailShell(html, opts),
        text: `${opts.headline}\n\n${opts.bodyText}\n\n${opts.ctaText}: ${opts.ctaUrl}\n\nUnsubscribe: ${opts.unsubscribeUrl || "https://linq.avtive.app/unsubscribe"}`,
      };
    },
  },
];
