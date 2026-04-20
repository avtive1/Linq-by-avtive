export const PASSWORD_POLICY = {
  minLength: 12,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSymbol: true,
};

export function validatePasswordPolicy(password: string): string[] {
  const errors: string[] = [];
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters.`);
  }
  if (PASSWORD_POLICY.requireUpper && !/[A-Z]/.test(password)) {
    errors.push("Password must include an uppercase letter.");
  }
  if (PASSWORD_POLICY.requireLower && !/[a-z]/.test(password)) {
    errors.push("Password must include a lowercase letter.");
  }
  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
    errors.push("Password must include a number.");
  }
  if (PASSWORD_POLICY.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must include a symbol.");
  }
  return errors;
}
