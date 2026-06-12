import { AsyncLocalStorage } from "node:async_hooks";

export type LogContext = {
  requestId?: string;
  userId?: string;
};

const logContextStorage = new AsyncLocalStorage<LogContext>();

export function getLogContext(): LogContext {
  return logContextStorage.getStore() ?? {};
}

export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  return logContextStorage.run(context, fn);
}

export async function runWithLogContextAsync<T>(
  context: LogContext,
  fn: () => Promise<T>,
): Promise<T> {
  return logContextStorage.run(context, fn);
}

/** Propagates context to the current async execution chain (Node 20+). */
export function enterLogContext(context: LogContext): void {
  logContextStorage.enterWith(context);
}
