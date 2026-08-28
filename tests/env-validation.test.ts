import { describe, expect, it } from "vitest";

import { getMissingRequiredEnv, validateRequiredEnv } from "@/lib/env";

describe("environment validation", () => {
  it("returns missing required variables in a clear list", () => {
    const missing = getMissingRequiredEnv(["DATABASE_URL", "NEXT_PUBLIC_APP_URL"], {});
    expect(missing).toContain("DATABASE_URL");
    expect(missing).toContain("NEXT_PUBLIC_APP_URL");
  });

  it("throws a readable error when a required variable is empty", () => {
    expect(() =>
      validateRequiredEnv(["DATABASE_URL"], {
        env: { DATABASE_URL: "" },
      }),
    ).toThrowError(/DATABASE_URL/i);
  });
});
