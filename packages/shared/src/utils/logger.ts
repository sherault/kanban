export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

const LOG_LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  none: LogLevel.NONE,
};

export class Logger {
  private level: LogLevel;
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;

    const envLevel =
      typeof process !== "undefined" ? process.env["LOG_LEVEL"] : null;
    const nodeEnv =
      typeof process !== "undefined" ? process.env["NODE_ENV"] : "development";

    if (envLevel) {
      this.level = LOG_LEVEL_MAP[envLevel.toLowerCase()] ?? LogLevel.INFO;
    } else {
      // Default based on environment: DEBUG for dev/test, ERROR for production
      this.level = nodeEnv === "production" ? LogLevel.ERROR : LogLevel.DEBUG;
    }
  }

  debug(message: string, ...args: any[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[DEBUG] [${this.prefix}] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.level <= LogLevel.INFO) {
      console.log(`[INFO]  [${this.prefix}] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN]  [${this.prefix}] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] [${this.prefix}] ${message}`, ...args);
    }
  }
}

export const createLogger = (prefix: string) => new Logger(prefix);
