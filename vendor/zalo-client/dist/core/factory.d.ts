/**
 * API factory: the shared plumbing every endpoint implementation is built on.
 */
import type { ContextBase, ContextSession } from "./context.js";
import { encodeAES } from "./crypto.js";
import { makeURL as buildURL, request as httpRequest } from "./http.js";
import { logger } from "./logger.js";
import type { ZaloApi } from "../api/index.js";
export type ZaloResponse<T> = {
    data: T | null;
    error: {
        message: string;
        code?: number;
    } | null;
};
/**
 * Reads a Zalo API response, optionally decrypting its AES payload.
 */
export declare function handleZaloResponse<T = unknown>(ctx: ContextSession, response: Response, isEncrypted?: boolean): Promise<ZaloResponse<T>>;
/**
 * Resolves a response into plain data, throwing {@link ZaloApiError} on failure.
 */
export declare function resolveResponse<T = unknown>(ctx: ContextSession, res: Response, cb?: (result: ZaloResponse<unknown>) => T, isEncrypted?: boolean): Promise<T>;
/**
 * Helpers handed to every endpoint implementation.
 */
export type FactoryUtils<T> = {
    makeURL: (baseURL: string, params?: Record<string, string | number>, apiVersion?: boolean) => ReturnType<typeof buildURL>;
    encodeAES: (data: string | Buffer) => ReturnType<typeof encodeAES>;
    request: (url: string, options?: RequestInit, raw?: boolean) => ReturnType<typeof httpRequest>;
    logger: ReturnType<typeof logger>;
    resolve: (res: Response, cb?: (result: ZaloResponse<unknown>) => T, isEncrypted?: boolean) => ReturnType<typeof resolveResponse<T>>;
};
/**
 * Creates an endpoint factory.
 *
 * @example
 * const myFactory = apiFactory<MyResponse>()((api, ctx, utils) => {
 *     return async function myEndpoint(param: string) {
 *         const res = await utils.request(utils.makeURL(api.zpwServiceMap.chat[0] + "/..."));
 *         return utils.resolve(res);
 *     };
 * });
 */
export declare function apiFactory<T>(): <K extends (api: ZaloApi, ctx: ContextSession, utils: FactoryUtils<T>) => unknown>(callback: K) => (ctx: ContextBase, api: ZaloApi) => ReturnType<K>;
