import { describe, expect, it } from "vitest";
import { validatePasswordPolicy } from "@/lib/security/password-policy";
import { normalizeOrganizationName, toOrganizationKey } from "@/lib/organization/normalize";

describe("admin organizations creation and validation", () => {
  it("enforces strong password policy", () => {
    // Too short
    expect(validatePasswordPolicy("short")).toContain("Password must be at least 12 characters.");
    // Missing uppercase
    expect(validatePasswordPolicy("lowercase123!@#")).toContain("Password must include an uppercase letter.");
    // Missing lowercase
    expect(validatePasswordPolicy("UPPERCASE123!@#")).toContain("Password must include a lowercase letter.");
    // Missing number
    expect(validatePasswordPolicy("UpperLowerCase!@#")).toContain("Password must include a number.");
    // Missing symbol
    expect(validatePasswordPolicy("UpperLower123456")).toContain("Password must include a symbol.");
    // Valid password
    expect(validatePasswordPolicy("ValidPass123!@#")).toEqual([]);
  });

  it("normalizes organization names and keys correctly", () => {
    const orgName = "  Acme Corp & Co.  ";
    const normalized = normalizeOrganizationName(orgName);
    expect(normalized).toBe("acme corp & co.");

    const key = toOrganizationKey(orgName);
    expect(key).toBe("acmecorpco");
  });
});
