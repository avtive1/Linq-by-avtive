export function validateCsrfOrigin(req: Request): { ok: boolean; reason?: string } {
  const requestOrigin = new URL(req.url).origin;
  const originHeader = req.headers.get("origin");
  const refererHeader = req.headers.get("referer");

  if (originHeader) {
    try {
      if (new URL(originHeader).origin === requestOrigin) return { ok: true };
      return { ok: false, reason: "Origin mismatch." };
    } catch {
      return { ok: false, reason: "Invalid Origin header." };
    }
  }

  if (refererHeader) {
    try {
      if (new URL(refererHeader).origin === requestOrigin) return { ok: true };
      return { ok: false, reason: "Referer mismatch." };
    } catch {
      return { ok: false, reason: "Invalid Referer header." };
    }
  }

  return { ok: false, reason: "Missing Origin/Referer header." };
}
