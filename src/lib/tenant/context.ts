import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  /** Organization owner user id — the tenant boundary for org-owned data. */
  tenantId: string;
  /** Authenticated user id (may differ from tenantId for org members). */
  userId: string;
  /** Skip RLS policies (platform admin / migrations only). */
  bypassRls?: boolean;
};

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | null {
  return tenantStorage.getStore() ?? null;
}

export function getCurrentTenantId(): string | null {
  return getTenantContext()?.tenantId ?? null;
}

export function getCurrentUserId(): string | null {
  return getTenantContext()?.userId ?? null;
}

export function isRlsBypassed(): boolean {
  return Boolean(getTenantContext()?.bypassRls);
}

export function runWithTenantContext<T>(context: TenantContext, fn: () => T): T {
  return tenantStorage.run(context, fn);
}

export async function runWithTenantContextAsync<T>(
  context: TenantContext,
  fn: () => Promise<T>,
): Promise<T> {
  return tenantStorage.run(context, fn);
}
