type AccessRequestEmailInput = {
  to: string;
  subject: string;
  text: string;
};

type SendEmailResult = {
  sent: boolean;
  error?: string;
};

/**
 * Sends email via Resend API when configured.
 * This is intentionally best-effort so product flows never break if email provider is unavailable.
 */
export async function sendTransactionalEmail(input: AccessRequestEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "no-reply@avtive.app";
  if (!apiKey) {
    return { sent: false, error: "Email provider not configured." };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { sent: false, error: `Resend error ${res.status}: ${body}` };
    }
    return { sent: true };
  } catch (error) {
    console.error("Email send failed:", error);
    return { sent: false, error: error instanceof Error ? error.message : "Email send failed." };
  }
}
