export function generateRegistrationApprovedEmailHtml(params: {
  eventName: string;
  cardLink: string;
  eventLink: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Approved</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #41295a 0%, #2f0743 100%); padding: 40px 40px 60px 40px; text-align: center;">
              <div style="width: 64px; height: 64px; background-color: rgba(255, 255, 255, 0.15); border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">Registration Approved!</h1>
              <p style="margin: 12px 0 0 0; font-size: 16px; color: rgba(255, 255, 255, 0.85); line-height: 1.5;">You're all set for the event</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              
              <!-- Success Message -->
              <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 32px;">
                <p style="margin: 0; font-size: 15px; color: #166534; line-height: 1.6;">
                  <strong>Great news!</strong> Your registration for <strong>${params.eventName}</strong> has been approved. We're excited to have you join us!
                </p>
              </div>
              
              <!-- Event Details -->
              <div style="background-color: #fafafa; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">Event Details</h2>
                <div style="display: flex; align-items: center; margin-bottom: 12px;">
                  <div style="width: 40px; height: 40px; background-color: #e5e5ea; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#41295a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </div>
                  <div>
                    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1a1a1a;">${params.eventName}</p>
                    <p style="margin: 4px 0 0 0; font-size: 13px; color: #6e6e73;">Campaign Event</p>
                  </div>
                </div>
              </div>
              
              <!-- Action Buttons -->
              <div style="margin-bottom: 32px;">
                <!-- Primary CTA -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                  <tr>
                    <td>
                      <a href="${params.cardLink}" style="display: block; background: linear-gradient(135deg, #41295a 0%, #2f0743 100%); color: #ffffff; text-decoration: none; padding: 16px 24px; border-radius: 12px; font-size: 16px; font-weight: 600; text-align: center; box-shadow: 0 4px 12px rgba(65, 41, 90, 0.3);">
                        View Your Attendee Card →
                      </a>
                    </td>
                  </tr>
                </table>
                
                <!-- Secondary CTA -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <a href="${params.eventLink}" style="display: block; background-color: #f5f5f7; color: #41295a; text-decoration: none; padding: 16px 24px; border-radius: 12px; font-size: 15px; font-weight: 600; text-align: center; border: 1px solid #e5e5ea;">
                        View Event Page
                      </a>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- What's Next -->
              <div style="border-top: 1px solid #e5e5ea; padding-top: 24px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">What's Next?</h3>
                <ul style="margin: 0; padding-left: 20px; color: #6e6e73; font-size: 14px; line-height: 1.7;">
                  <li style="margin-bottom: 8px;">Access your personalized attendee card with your details</li>
                  <li style="margin-bottom: 8px;">Save the event page for quick reference</li>
                  <li style="margin-bottom: 8px;">Share your attendance card with other participants</li>
                </ul>
              </div>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 32px 40px; text-align: center; border-top: 1px solid #e5e5ea;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #6e6e73; line-height: 1.6;">
                Need help? Contact the event organizer or visit our support page.
              </p>
              <p style="margin: 0; font-size: 12px; color: #a1a1a6;">
                © ${new Date().getFullYear()} Avtive. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Footer links -->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; margin-top: 24px;">
          <tr>
            <td style="text-align: center; padding: 0 20px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1a6; line-height: 1.5;">
                This email was sent because your registration was approved for ${params.eventName}.
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
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6e6e73 0%, #4a4a4f 100%); padding: 40px 40px 60px 40px; text-align: center;">
              <div style="width: 64px; height: 64px; background-color: rgba(255, 255, 255, 0.15); border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em;">Registration Update</h1>
              <p style="margin: 12px 0 0 0; font-size: 16px; color: rgba(255, 255, 255, 0.85);">About your event registration</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #1a1a1a; line-height: 1.6;">
                Thank you for your interest in <strong>${params.eventName}</strong>. After careful review, we're unable to approve your registration at this time.
              </p>
              
              <!-- Reason Box -->
              <div style="background-color: #fef3f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin-bottom: 32px;">
                <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #991b1b; text-transform: uppercase; letter-spacing: 0.05em;">Reason</p>
                <p style="margin: 0; font-size: 15px; color: #7f1d1d; line-height: 1.6;">
                  ${params.rejectionReason}
                </p>
              </div>
              
              <!-- Next Steps -->
              <div style="background-color: #fafafa; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">What You Can Do</h3>
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #6e6e73; line-height: 1.6;">
                  If you believe this was a mistake or have questions, please contact the event organizer directly. You may also consider re-applying if circumstances change.
                </p>
              </div>
              
              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <a href="${params.eventLink}" style="display: block; background-color: #f5f5f7; color: #41295a; text-decoration: none; padding: 16px 24px; border-radius: 12px; font-size: 15px; font-weight: 600; text-align: center; border: 1px solid #e5e5ea;">
                      View Event Page
                    </a>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #fafafa; padding: 32px 40px; text-align: center; border-top: 1px solid #e5e5ea;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #6e6e73; line-height: 1.6;">
                Need assistance? Contact the event organizer for more information.
              </p>
              <p style="margin: 0; font-size: 12px; color: #a1a1a6;">
                © ${new Date().getFullYear()} Avtive. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
        
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; margin-top: 24px;">
          <tr>
            <td style="text-align: center; padding: 0 20px;">
              <p style="margin: 0; font-size: 12px; color: #a1a1a6; line-height: 1.5;">
                This email was sent regarding your registration for ${params.eventName}.
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
