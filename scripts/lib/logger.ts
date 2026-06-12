import pino from "pino";

const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: process.env.LOG_SERVICE_NAME ?? "avtive-scripts",
  },
  formatters: {
    level(label) {
      return { severity: label };
    },
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});

type LogMeta = Record<string, unknown>;

function write(
  level: "debug" | "info" | "warn" | "error",
  metaOrMsg: LogMeta | string,
  msg?: string,
): void {
  if (typeof metaOrMsg === "string") {
    baseLogger[level](metaOrMsg);
    return;
  }
  if (msg) {
    baseLogger[level](metaOrMsg, msg);
  } else {
    baseLogger[level](metaOrMsg);
  }
}

export const logger = {
  debug(metaOrMsg: LogMeta | string, msg?: string) {
    write("debug", metaOrMsg, msg);
  },
  info(metaOrMsg: LogMeta | string, msg?: string) {
    write("info", metaOrMsg, msg);
  },
  warn(metaOrMsg: LogMeta | string, msg?: string) {
    write("warn", metaOrMsg, msg);
  },
  error(metaOrMsg: LogMeta | string, msg?: string) {
    write("error", metaOrMsg, msg);
  },
};
