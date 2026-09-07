export interface SpamScoreAnalysis {
  score: number; // 0 - 100 (100 is cleanest/best)
  grade: "A+" | "A" | "B" | "C" | "F";
  issues: string[];
  suggestions: string[];
}

export interface RecipientLead {
  email: string;
  name?: string;
  company?: string;
  eventName?: string;
  source: "attendee" | "profile" | "manual";
}

/**
 * Heuristic spam score calculator based on anti-spam industry standards (SpamAssassin / Gmail rules).
 * Client-safe pure function.
 */
export function analyzeEmailSpamScore(subject: string, bodyText: string): SpamScoreAnalysis {
  let score = 100;
  const issues: string[] = [];
  const suggestions: string[] = [];

  const combined = `${subject} ${bodyText}`.toLowerCase();

  // Subject line checks
  if (subject.length < 5) {
    score -= 15;
    issues.push("Subject line is too short.");
    suggestions.push("Write a descriptive subject between 20 and 60 characters.");
  } else if (subject.length > 80) {
    score -= 10;
    issues.push("Subject line is too long for mobile inboxes.");
    suggestions.push("Keep subject lines under 60 characters for best display on iOS/Android.");
  }

  // All-caps check in subject
  const uppercaseChars = subject.replace(/[^A-Z]/g, "").length;
  const totalLetters = subject.replace(/[^a-zA-Z]/g, "").length;
  if (totalLetters > 5 && uppercaseChars / totalLetters > 0.4) {
    score -= 25;
    issues.push("Subject contains excessive capital letters (ALL CAPS).");
    suggestions.push("Use standard sentence or title case in subject.");
  }

  // Excessive exclamation / question marks
  if ((subject.match(/!{2,}|\?{2,}/g) || []).length > 0) {
    score -= 20;
    issues.push("Subject contains repeated punctuation (e.g., '!!!' or '???').");
    suggestions.push("Avoid multiple consecutive exclamation marks.");
  }

  // Spam trigger keywords
  const triggerWords = [
    "100% free",
    "make money fast",
    "risk free",
    "act now",
    "click here immediately",
    "winner",
    "miracle",
    "guaranteed cash",
    "no credit card required",
    "no catch",
    "double your income",
  ];

  triggerWords.forEach((word) => {
    if (combined.includes(word)) {
      score -= 15;
      issues.push(`Contains spam trigger phrase: "${word}".`);
      suggestions.push(`Rephrase or remove high-risk promotional keyword "${word}".`);
    }
  });

  // Check body length
  if (bodyText.trim().length < 20) {
    score -= 20;
    issues.push("Email body text is too sparse.");
    suggestions.push("Ensure your email contains substantial personalized context.");
  }

  score = Math.max(0, Math.min(100, score));

  let grade: SpamScoreAnalysis["grade"] = "A+";
  if (score < 50) grade = "F";
  else if (score < 70) grade = "C";
  else if (score < 85) grade = "B";
  else if (score < 95) grade = "A";

  if (suggestions.length === 0) {
    suggestions.push("Subject and body adhere to optimal deliverability guidelines.");
  }

  return { score, grade, issues, suggestions };
}

/**
 * Replaces personalization placeholders with lead values.
 */
export function interpolateEmailContent(
  content: string,
  lead: RecipientLead,
  orgName: string,
  unsubscribeUrl: string,
): string {
  const firstName = lead.name ? lead.name.trim().split(" ")[0] : "there";
  const fullName = lead.name ? lead.name.trim() : "Valued Member";
  const company = lead.company ? lead.company.trim() : orgName;

  return content
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*name\s*\}\}/gi, fullName)
    .replace(/\{\{\s*company\s*\}\}/gi, company)
    .replace(/\{\{\s*event_name\s*\}\}/gi, lead.eventName || orgName)
    .replace(/\{\{\s*organization_name\s*\}\}/gi, orgName)
    .replace(/\{\{\s*unsubscribe_url\s*\}\}/gi, unsubscribeUrl)
    .replace(/\{\{\s*email\s*\}\}/gi, lead.email);
}
