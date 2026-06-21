export function generateVisitorAttendanceCodeEmailHtml(params: {
  eventName: string;
  attendanceCode: string;
}): string {
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Attendance Code</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;background:#f5f5f7;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:36px 30px;text-align:center;background:linear-gradient(135deg,#41295a,#2f0743);">
              <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Your Attendance Code</h1>
              <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${params.eventName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:30px;text-align:center;">
              <p style="margin:0 0 12px;font-size:14px;color:#1a1a1a;line-height:1.6;">
                Present this code at the event entrance:
              </p>
              <p style="margin:0 0 18px;font-size:32px;font-weight:700;letter-spacing:0.25em;color:#41295a;">
                ${params.attendanceCode}
              </p>
              <p style="margin:0;font-size:13px;color:#6e6e73;line-height:1.6;">
                Keep this email handy when you arrive.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px;text-align:center;background:#fafafa;border-top:1px solid #e5e5ea;">
              <p style="margin:0;font-size:12px;color:#6e6e73;">© ${year} Avtive. All rights reserved.</p>
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

function appendAttendanceCodeToApprovedEmailText(text: string, attendanceCode: string): string {
  return (
    `${text}\n\n` +
    `Your attendance code: ${attendanceCode}\n` +
    `Present this code at the event entrance.`
  );
}

function appendAttendanceCodeToApprovedEmailHtml(html: string, attendanceCode: string): string {
  const block = `
              <div style="margin-top:26px;border-top:1px solid #e5e5ea;padding-top:18px;">
                <p style="margin:0 0 8px;font-weight:600;color:#1a1a1a;font-size:14px;">
                  Your attendance code
                </p>
                <p style="margin:0 0 6px;font-size:22px;font-weight:700;letter-spacing:0.2em;color:#41295a;">
                  ${attendanceCode}
                </p>
                <p style="margin:0;font-size:13px;color:#6e6e73;line-height:1.6;">
                  Present this code at the event entrance.
                </p>
              </div>`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${block}\n</body>`);
  }
  return `${html}${block}`;
}

export { appendAttendanceCodeToApprovedEmailHtml, appendAttendanceCodeToApprovedEmailText };
