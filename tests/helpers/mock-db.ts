import { vi } from "vitest";

export type MockQueryFn = ReturnType<typeof vi.fn>;

export function createMockSqlClient(options?: {
  queryImpl?: (...args: unknown[]) => Promise<unknown>;
  transactionImpl?: (queries: unknown[]) => Promise<unknown[]>;
}) {
  const query = vi.fn(options?.queryImpl ?? (async () => []));
  const transaction = vi.fn(
    options?.transactionImpl ??
      (async (queries: unknown[]) => {
        const results: unknown[] = [];
        for (const q of queries) {
          if (typeof q === "function") {
            results.push(await (q as () => Promise<unknown>)());
          } else {
            results.push(await query(q));
          }
        }
        return results;
      }),
  );

  return { query, transaction };
}

export function transientDbError(message = "fetch failed: connection terminated") {
  return new Error(message);
}

export function uniqueViolationError() {
  const err = new Error('duplicate key value violates unique constraint "events_short_id_idx"') as Error & {
    code: string;
  };
  err.code = "23505";
  return err;
}
