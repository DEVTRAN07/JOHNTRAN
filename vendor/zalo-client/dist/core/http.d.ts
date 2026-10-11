/**
 * HTTP engine: cookie-aware `fetch` wrapper used by every API call.
 *
 * Requests go through a retry policy (exponential backoff with jitter, only
 * for idempotent methods by default) and a per-request timeout, so a flaky
 * network fails fast instead of hanging the process.
 */
import type { ContextBase } from "./context.js";
/**
 * Builds a Zalo API URL, appending query params and (by default) the API
 * version/type markers.
 */
export declare function makeURL(ctx: ContextBase, baseURL: string, params?: Record<string, string | number>, apiVersion?: boolean): string;
/**
 * Builds the default browser-like headers, injecting the session cookie for the
 * request origin.
 */
export declare function getDefaultHeaders(ctx: ContextBase, origin?: string): Promise<Record<string, string>>;
/**
 * Performs a request with the session cookie jar, default headers, redirect
 * following, timeout and the configured retry policy.
 *
 * @param raw When `true`, bypasses header injection and cookie persistence
 * (used for raw HTML/navigation requests such as the login page).
 */
export declare function request(ctx: ContextBase, url: string, options?: RequestInit, raw?: boolean): Promise<Response>;
