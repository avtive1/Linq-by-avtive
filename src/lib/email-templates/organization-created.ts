function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generateOrganizationCreatedWelcomeEmailHtml(params: {
  organizationName: string;
  loginEmail: string;
  temporaryPassword: string;
  loginUrl: string;
  logoUrl: string;
}): string {
  const year = new Date().getFullYear();
  const organizationName = escapeHtml(params.organizationName);
  const loginEmail = escapeHtml(params.loginEmail);
  const temporaryPassword = escapeHtml(params.temporaryPassword);
  const loginUrl = escapeHtml(params.loginUrl);
  const logoUrl = escapeHtml(params.logoUrl);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Your organization is ready on AVTIVE</title>
</head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:32px 16px;background:#f7f8fa;">
    <tr>
      <td align="center">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e0e2e8;border-radius:12px;overflow:hidden;">

          <!-- Logo header -->
          <tr>
            <td align="center" style="padding:28px 32px 20px;background:#ffffff;border-bottom:1px solid #eef0f3;">
              <img
                src="${logoUrl}"
                alt="AVTIVE"
                width="138"
                height="32"
                style="display:block;width:138px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;"
              />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 8px;">

              <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;font-weight:700;color:#1c1c1e;">
                Your organization is ready on AVTIVE
              </h1>

              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1c1c1e;">
                Hi there,
              </p>

              <p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#555a6a;">
                Your organization <strong style="color:#1c1c1e;">${organizationName}</strong> has been created.
                Use the login details below to access your dashboard and get started.
              </p>

              <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#555a6a;">
                Use this email address (<strong style="color:#1c1c1e;">${loginEmail}</strong>) along with the temporary password below to log in.
                For security, change your password after your first sign-in (Profile / security).
              </p>

              <!-- Credentials box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;border:1px solid #e0e2e8;border-radius:10px;background:#fafbfc;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 14px;font-size:12px;line-height:1.4;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#6b6f7e;">
                      Your login credentials
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:0 0 12px;font-size:13px;line-height:1.5;color:#6b6f7e;width:42%;vertical-align:top;">
                          Login email
                        </td>
                        <td style="padding:0 0 12px;font-size:14px;line-height:1.5;font-weight:600;color:#1c1c1e;word-break:break-all;">
                          ${loginEmail}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0;font-size:13px;line-height:1.5;color:#6b6f7e;width:42%;vertical-align:top;">
                          Temporary password
                        </td>
                        <td style="padding:0;font-size:14px;line-height:1.5;font-weight:600;color:#1c1c1e;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;word-break:break-all;">
                          ${temporaryPassword}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 8px;">
                <tr>
                  <td align="center" bgcolor="#1c1c1e" style="border-radius:8px;background:#1c1c1e;">
                    <a
                      href="${loginUrl}"
                      target="_blank"
                      style="display:inline-block;padding:14px 28px;font-size:16px;line-height:1.3;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;"
                    >
                      Go to Login
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#6b6f7e;text-align:center;">
                Or copy and paste this link into your browser:<br />
                <a href="${loginUrl}" style="color:#4262ff;word-break:break-all;">${loginUrl}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 32px 28px;background:#fafbfc;border-top:1px solid #eef0f3;">
              <img
                src="${logoUrl}"
                alt="AVTIVE"
                width="104"
                height="24"
                style="display:block;width:104px;max-width:100%;height:auto;margin:0 auto 14px;border:0;outline:none;text-decoration:none;opacity:0.9;"
              />
              <p style="margin:0;font-size:12px;line-height:1.5;color:#8e91a0;">
                © ${year} AVTIVE. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
}
