import { describe, expect, it } from "vitest";
import {
  attendanceCodesMatch,
  generateSixDigitAttendanceCode,
  isValidAttendanceCodeFormat,
} from "@/lib/attendance-code";

describe("attendance-code", () => {
  it("generates a 6-digit numeric code", () => {
    const code = generateSixDigitAttendanceCode();
    expect(isValidAttendanceCodeFormat(code)).toBe(true);
    expect(code).toHaveLength(6);
  });

  it("matches equal codes and rejects mismatches", () => {
    expect(attendanceCodesMatch("123456", "123456")).toBe(true);
    expect(attendanceCodesMatch("123456", "123457")).toBe(false);
    expect(attendanceCodesMatch("12345", "123456")).toBe(false);
  });
});
