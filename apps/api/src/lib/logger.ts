/**
 * Minimal logger that respects LOG_LEVEL environment variable.
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const CURRENT_LEVEL = ((): LogLevel => {
  const envLevel = process.env["LOG_LEVEL"]?.toUpperCase();
  switch (envLevel) {
    case "DEBUG":
      return LogLevel.DEBUG;
    case "INFO":
      return LogLevel.INFO;
    case "WARN":
      return LogLevel.WARN;
    case "ERROR":
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
})();

export const logger = {
  debug: (...args: unknown[]) => {
    if (CURRENT_LEVEL <= LogLevel.DEBUG) console.log("[DEBUG]", ...args);
  },
  info: (...args: unknown[]) => {
    // Use console.log for maximum compatibility with all terminal/docker variants
    if (CURRENT_LEVEL <= LogLevel.INFO) console.log("[INFO]", ...args);
  },
  warn: (...args: unknown[]) => {
    if (CURRENT_LEVEL <= LogLevel.WARN) console.log("[WARN]", ...args);
  },
  error: (...args: unknown[]) => {
    if (CURRENT_LEVEL <= LogLevel.ERROR) console.error("[ERROR]", ...args);
  },
};
