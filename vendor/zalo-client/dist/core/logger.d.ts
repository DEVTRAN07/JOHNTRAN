/**
 * Lightweight leveled logger.
 *
 * The logger is intentionally dependency-free: log records are written to the
 * console only when logging is enabled through the client options.
 */
export type LogLevel = "silent" | "error" | "warn" | "info" | "verbose";
export type Logger = {
    verbose: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    success: (...args: unknown[]) => void;
    timestamp: (...args: unknown[]) => void;
};
export type LoggableContext = {
    options: {
        logging?: boolean | LogLevel;
    };
};
/**
 * Creates a logger bound to a context (or any object exposing `options.logging`).
 */
export declare function logger(ctx: LoggableContext): Logger;
