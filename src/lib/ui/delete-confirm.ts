/** Normalize typed confirmation text for campaign delete dialogs. */
export function normalizeDeleteConfirmText(value: string): string {
  return value.normalize("NFC").trim().replace(/\u00A0/g, " ");
}

export function isDeleteConfirmMatch(input: string, target: string): boolean {
  return normalizeDeleteConfirmText(input) === normalizeDeleteConfirmText(target);
}
