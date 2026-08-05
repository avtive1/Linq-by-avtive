import { getOrganizationEmailLogoSrc } from "@/lib/email-templates/organization-logo";
import {
  getEmailSocialIconSrc,
  type EmailSocialIconKey,
} from "@/lib/email-templates/social-icons";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailDetailRow = {
  label: string;
  value: string;
  monospace?: boolean;
};

export function emailParagraph(html: string, marginBottom = 16): string {
  return `<p style="margin:0 0 ${marginBottom}px;font-size:15px;line-height:1.65;color:#555a6a;">${html}</p>`;
}

export function emailDetailBox(title: string, rows: EmailDetailRow[]): string {
  const rowHtml = rows
    .map((row, index) => {
      const valueStyle = row.monospace
        ? "font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;"
        : "";
      return `
                      <tr>
                        <td style="padding:${index < rows.length - 1 ? "0 0 12px" : "0"};font-size:13px;line-height:1.5;color:#6b6f7e;width:42%;vertical-align:top;">
                          ${escapeHtml(row.label)}
                        </td>
                        <td style="padding:${index < rows.length - 1 ? "0 0 12px" : "0"};font-size:14px;line-height:1.5;font-weight:600;color:#1c1c1e;word-break:break-all;${valueStyle}">
                          ${escapeHtml(row.value)}
                        </td>
                      </tr>`;
    })
    .join("");

  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;border:1px solid #e0e2e8;border-radius:10px;background:#fafbfc;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 14px;font-size:12px;line-height:1.4;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#6b6f7e;">
                      ${escapeHtml(title)}
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${rowHtml}
                    </table>
                  </td>
                </tr>
              </table>`;
}

export function emailHighlightBox(contentHtml: string, tone: "success" | "warning" | "neutral" = "neutral"): string {
  const styles = {
    success: { bg: "#ecfdf3", border: "#bbf7d0", text: "#166534" },
    warning: { bg: "#fff8e0", border: "#ffd02f", text: "#746019" },
    neutral: { bg: "#fafbfc", border: "#e0e2e8", text: "#555a6a" },
  }[tone];

  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;border:1px solid ${styles.border};border-radius:10px;background:${styles.bg};">
                <tr>
                  <td style="padding:16px 18px;font-size:14px;line-height:1.6;color:${styles.text};">
                    ${contentHtml}
                  </td>
                </tr>
              </table>`;
}

export function emailCodeDisplay(label: string, code: string): string {
  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;border:1px solid #e0e2e8;border-radius:10px;background:#fafbfc;">
                <tr>
                  <td align="center" style="padding:22px 20px;">
                    <p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:#6b6f7e;">${escapeHtml(label)}</p>
                    <p style="margin:0;font-size:30px;line-height:1.2;font-weight:700;letter-spacing:0.2em;color:#1c1c1e;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;">
                      ${escapeHtml(code)}
                    </p>
                  </td>
                </tr>
              </table>`;
}

export const ATTENDANCE_QR_CID = "attendance-qr-code@avtive.app";

export function emailQrCodeDisplay(label: string, qrDataUrlOrCid?: string | null): string {
  const src =
    qrDataUrlOrCid && (qrDataUrlOrCid.startsWith("cid:") || !qrDataUrlOrCid.startsWith("data:"))
      ? qrDataUrlOrCid
      : `cid:${ATTENDANCE_QR_CID}`;

  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;border:1px solid #e0e2e8;border-radius:10px;background:#fafbfc;">
                <tr>
                  <td align="center" style="padding:22px 20px;">
                    <p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:#6b6f7e;">${escapeHtml(label)}</p>
                    <div style="display:inline-block;padding:12px;background:#ffffff;border:1px solid #e0e2e8;border-radius:8px;">
                      <img src="${src}" alt="Attendance QR Code" width="180" height="180" style="display:block;width:180px;height:180px;border:0;outline:none;text-decoration:none;" />
                    </div>
                  </td>
                </tr>
              </table>`;
}

export function emailPrimaryButton(label: string, href: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 8px;">
                <tr>
                  <td align="center" bgcolor="#1c1c1e" style="border-radius:8px;background:#1c1c1e;">
                    <a href="${safeHref}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:16px;line-height:1.3;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      ${safeLabel}
                    </a>
                  </td>
                </tr>
              </table>`;
}

export function emailLinkFallback(href: string): string {
  const safeHref = escapeHtml(href);
  return `
              <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#6b6f7e;text-align:center;">
                Or copy and paste this link into your browser:<br />
                <a href="${safeHref}" style="color:#4262ff;word-break:break-all;">${safeHref}</a>
              </p>`;
}

export function emailSecondaryButton(label: string, href: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 12px;width:100%;">
                <tr>
                  <td align="center" style="border-radius:8px;border:1px solid #e0e2e8;background:#fafbfc;">
                    <a href="${safeHref}" target="_blank" style="display:inline-block;padding:14px 18px;font-size:16px;line-height:1.3;font-weight:600;color:#1c1c1e;text-decoration:none;border-radius:8px;width:100%;box-sizing:border-box;">
                      ${safeLabel}
                    </a>
                  </td>
                </tr>
              </table>`;
}

const AVTIVE_SOCIAL_LINKS = {
  instagram: "https://www.instagram.com/avtive.app?igsh=MWd1N3JpczQwMno1OQ==",
  linkedin: "https://www.linkedin.com/company/avtive/",
  facebook: "https://www.facebook.com/avtiveapp/",
  email: "mailto:info@avtive.app",
  whatsapp: "https://wa.me/923125175041",
} as const;

function emailSocialIconCell(
  href: string,
  label: string,
  iconKey: EmailSocialIconKey,
): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  const iconSrc = escapeHtml(getEmailSocialIconSrc(iconKey));
  return `
                <td align="center" style="padding:0 5px;">
                  <a href="${safeHref}" target="_blank" rel="noopener noreferrer" aria-label="${safeLabel}" title="${safeLabel}" style="display:inline-block;width:36px;height:36px;background:#3d4249;border-radius:6px;text-decoration:none;text-align:center;line-height:36px;">
                    <img src="${iconSrc}" alt="${safeLabel}" width="18" height="18" style="display:inline-block;width:18px;height:18px;margin-top:9px;border:0;vertical-align:top;" />
                  </a>
                </td>`;
}

function emailSocialFooter(): string {
  const icons: Array<{ href: string; label: string; key: EmailSocialIconKey }> = [
    { href: AVTIVE_SOCIAL_LINKS.instagram, label: "Instagram", key: "instagram" },
    { href: AVTIVE_SOCIAL_LINKS.linkedin, label: "LinkedIn", key: "linkedin" },
    { href: AVTIVE_SOCIAL_LINKS.facebook, label: "Facebook", key: "facebook" },
    { href: AVTIVE_SOCIAL_LINKS.email, label: "Email", key: "email" },
    { href: AVTIVE_SOCIAL_LINKS.whatsapp, label: "WhatsApp", key: "whatsapp" },
  ];

  const iconCells = icons.map((icon) => emailSocialIconCell(icon.href, icon.label, icon.key)).join("");

  return `
              <p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:#8e91a0;text-align:center;max-width:480px;">
                You have received this email because you are registered at AVTIVE, to ensure the implementation of our Terms of Service and (or) for other legitimate matters.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;">
                <tr>
                  ${iconCells}
                </tr>
              </table>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8e91a0;">© 2025-2026 Avtive private limited</p>`;
}

export function wrapAvtiveEmailLayout(params: {
  pageTitle: string;
  headline: string;
  greeting?: string;
  bodyHtml: string;
  logoSrc?: string;
}): string {
  const logoSrc = escapeHtml(params.logoSrc ?? getOrganizationEmailLogoSrc());
  const pageTitle = escapeHtml(params.pageTitle);
  const headline = escapeHtml(params.headline);
  const greeting = params.greeting ?? "Hi there,";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${pageTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px;background:#f7f8fa;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e0e2e8;border-radius:12px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:28px 32px 20px;background:#ffffff;border-bottom:1px solid #eef0f3;">
              <img src="${logoSrc}" alt="AVTIVE" width="138" height="32" style="display:block;width:138px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px;">
              <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;font-weight:700;color:#1c1c1e;">${headline}</h1>
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1c1c1e;">${escapeHtml(greeting)}</p>
              ${params.bodyHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px 28px;background:#fafbfc;border-top:1px solid #eef0f3;">
              <img src="${logoSrc}" alt="AVTIVE" width="104" height="24" style="display:block;width:104px;max-width:100%;height:auto;margin:0 auto 14px;border:0;outline:none;text-decoration:none;opacity:0.9;" />
              ${emailSocialFooter()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
