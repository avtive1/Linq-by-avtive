import { describe, expect, it } from "vitest";
import { isDeleteConfirmMatch, normalizeDeleteConfirmText } from "@/lib/ui/delete-confirm";

describe("delete confirm matching", () => {
  it("matches trimmed input", () => {
    expect(isDeleteConfirmMatch("  Tech Summit  ", "Tech Summit")).toBe(true);
  });

  it("rejects mismatched names", () => {
    expect(isDeleteConfirmMatch("Tech Summit", "Other Event")).toBe(false);
  });

  it("normalizes non-breaking spaces", () => {
    expect(normalizeDeleteConfirmText("Tech\u00A0Summit")).toBe("Tech Summit");
    expect(isDeleteConfirmMatch("Tech Summit", "Tech\u00A0Summit")).toBe(true);
  });
});
