export function generateRegistrationApprovedEmailHtml(params: {
  eventName: string;
  cardLink: string;
  eventLink: string;
}): string {
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Registration Approved</title>
</head>

<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;background:#f5f5f7;">
    <tr>
      <td align="center">

        <!-- Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:40px 30px;text-align:center;background:linear-gradient(135deg,#41295a,#2f0743);">
              
              <div style="width:64px;height:64px;margin:0 auto 18px;background:rgba(255,255,255,0.12);border-radius:14px;line-height:64px;">
                <span style="font-size:26px;color:#fff;">✓</span>
              </div>

              <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">
                Registration Approved
              </h1>

              <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
                You're all set for the event
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px;">

              <!-- Success Box -->
              <div style="background:#ecfdf3;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:22px;">
                <p style="margin:0;color:#166534;font-size:14px;line-height:1.6;">
                  <strong>Great news!</strong> Your registration for <strong>${params.eventName}</strong> has been approved.
                </p>
              </div>

              <!-- Event Card -->
              <div style="background:#fafafa;border-radius:10px;padding:18px;margin-bottom:26px;">
                <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#1a1a1a;">
                  ${params.eventName}
                </p>
                <p style="margin:0;font-size:12px;color:#6e6e73;">
                  Campaign Event
                </p>
              </div>

              <!-- CTA 1 -->
              <a href="${params.cardLink}"
                 style="display:block;text-align:center;padding:14px 18px;margin-bottom:12px;
                 background:#41295a;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;">
                View Attendee Card →
              </a>

              <!-- CTA 2 -->
              <a href="${params.eventLink}"
                 style="display:block;text-align:center;padding:14px 18px;
                 background:#f5f5f7;color:#41295a;text-decoration:none;border-radius:10px;
                 border:1px solid #e5e5ea;font-weight:600;">
                View Event Page
              </a>

              <!-- Next Steps -->
              <div style="margin-top:26px;border-top:1px solid #e5e5ea;padding-top:18px;">
                <p style="margin:0 0 10px;font-weight:600;color:#1a1a1a;font-size:14px;">
                  What's Next?
                </p>

                <ul style="margin:0;padding-left:18px;color:#6e6e73;font-size:13px;line-height:1.7;">
                  <li>Access your attendee card</li>
                  <li>Save event details</li>
                  <li>Share your participation</li>
                </ul>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px;text-align:center;background:#fafafa;border-top:1px solid #e5e5ea;">
              <p style="margin:0;font-size:12px;color:#6e6e73;">
                © ${year} Avtive. All rights reserved.
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

export function generateRegistrationRejectedEmailHtml(params: {
  eventName: string;
  rejectionReason: string;
  eventLink: string;
}): string {
  const year = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Registration Update</title>
</head>

<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;background:#f5f5f7;">
    <tr>
      <td align="center">

        <!-- Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:40px 30px;text-align:center;background:linear-gradient(135deg,#6e6e73,#4a4a4f);">

              <div style="width:64px;height:64px;margin:0 auto 18px;background:rgba(255,255,255,0.12);border-radius:14px;line-height:64px;">
                <span style="font-size:26px;color:#fff;">!</span>
              </div>

              <h1 style="margin:0;color:#fff;font-size:26px;font-weight:700;">
                Registration Update
              </h1>

              <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
                We reviewed your application
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px;">

              <p style="margin:0 0 18px;font-size:14px;color:#1a1a1a;line-height:1.6;">
                Your registration for <strong>${params.eventName}</strong> was not approved at this time.
              </p>

              <!-- Reason Box -->
              <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;margin-bottom:22px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#991b1b;">
                  Reason
                </p>
                <p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.5;">
                  ${params.rejectionReason}
                </p>
              </div>

              <!-- Guidance -->
              <div style="background:#fafafa;border-radius:10px;padding:18px;margin-bottom:22px;">
                <p style="margin:0;font-size:13px;color:#6e6e73;line-height:1.6;">
                  You may contact the organizer if you believe this is a mistake or reapply if eligibility changes.
                </p>
              </div>

              <!-- CTA -->
              <a href="${params.eventLink}"
                 style="display:block;text-align:center;padding:14px 18px;
                 background:#f5f5f7;color:#41295a;text-decoration:none;border-radius:10px;
                 border:1px solid #e5e5ea;font-weight:600;">
                View Event Page
              </a>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px;text-align:center;background:#fafafa;border-top:1px solid #e5e5ea;">
              <p style="margin:0;font-size:12px;color:#6e6e73;">
                © ${year} Avtive. All rights reserved.
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
