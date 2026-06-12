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

function write(level, metaOrMsg, msg) {
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
  debug(metaOrMsg, msg) {
    write("debug", metaOrMsg, msg);
  },
  info(metaOrMsg, msg) {
    write("info", metaOrMsg, msg);
  },
  warn(metaOrMsg, msg) {
    write("warn", metaOrMsg, msg);
  },
  error(metaOrMsg, msg) {
    write("error", metaOrMsg, msg);
  },
};
