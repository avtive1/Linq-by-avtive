export function redactRecord(
  details?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (/token|secret|key|password|plaintext|cipher/i.test(k)) {
      clone[k] = "[REDACTED]";
      continue;
    }
    clone[k] = v;
  }
  return clone;
}
