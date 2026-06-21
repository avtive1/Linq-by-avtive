const ATTENDANCE_CODE_PATTERN = /^\d{6}$/;

export function generateSixDigitAttendanceCode(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

export function isValidAttendanceCodeFormat(code: string): boolean {
  return ATTENDANCE_CODE_PATTERN.test(String(code || "").trim());
}

/** Constant-time compare for equal-length 6-digit codes. */
export function attendanceCodesMatch(expected: string, provided: string): boolean {
  const a = String(expected || "").trim();
  const b = String(provided || "").trim();
  if (!ATTENDANCE_CODE_PATTERN.test(a) || !ATTENDANCE_CODE_PATTERN.test(b)) return false;
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
