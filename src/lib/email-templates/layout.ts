import { getOrganizationEmailLogoSrc } from "@/lib/email-templates/organization-logo";

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
  iconSvg: string,
): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `
                <td align="center" style="padding:0 5px;">
                  <a href="${safeHref}" target="_blank" rel="noopener noreferrer" aria-label="${safeLabel}" title="${safeLabel}" style="display:inline-block;width:36px;height:36px;background:#3d4249;border-radius:6px;text-decoration:none;line-height:36px;text-align:center;">
                    ${iconSvg}
                  </a>
                </td>`;
}

function emailSocialFooter(): string {
  const icons = [
    {
      href: AVTIVE_SOCIAL_LINKS.instagram,
      label: "Instagram",
      svg: `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z'/%3E%3C/svg%3E" alt="" width="18" height="18" style="display:inline-block;width:18px;height:18px;margin-top:9px;border:0;vertical-align:top;" />`,
    },
    {
      href: AVTIVE_SOCIAL_LINKS.linkedin,
      label: "LinkedIn",
      svg: `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 114.126 0 2.063 2.063 0 01-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'/%3E%3C/svg%3E" alt="" width="18" height="18" style="display:inline-block;width:18px;height:18px;margin-top:9px;border:0;vertical-align:top;" />`,
    },
    {
      href: AVTIVE_SOCIAL_LINKS.facebook,
      label: "Facebook",
      svg: `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z'/%3E%3C/svg%3E" alt="" width="18" height="18" style="display:inline-block;width:18px;height:18px;margin-top:9px;border:0;vertical-align:top;" />`,
    },
    {
      href: AVTIVE_SOCIAL_LINKS.email,
      label: "Email",
      svg: `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z'/%3E%3C/svg%3E" alt="" width="18" height="18" style="display:inline-block;width:18px;height:18px;margin-top:9px;border:0;vertical-align:top;" />`,
    },
    {
      href: AVTIVE_SOCIAL_LINKS.whatsapp,
      label: "WhatsApp",
      svg: `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'/%3E%3C/svg%3E" alt="" width="18" height="18" style="display:inline-block;width:18px;height:18px;margin-top:9px;border:0;vertical-align:top;" />`,
    },
  ];

  const iconCells = icons.map((icon) => emailSocialIconCell(icon.href, icon.label, icon.svg)).join("");

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
