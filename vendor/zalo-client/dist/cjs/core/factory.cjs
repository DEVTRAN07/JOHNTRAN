'use strict';

var errors = require('./errors.cjs');
var crypto = require('./crypto.cjs');
var http = require('./http.cjs');
var logger = require('./logger.cjs');
var context = require('./context.cjs');

/**
 * API factory: the shared plumbing every endpoint implementation is built on.
 */
/**
 * Reads a Zalo API response, optionally decrypting its AES payload.
 */
async function handleZaloResponse(ctx, response, isEncrypted = true) {
    const result = {
        data: null,
        error: null,
    };
    if (!response.ok) {
        result.error = {
            message: "Request failed with status code " + response.status,
        };
        return result;
    }
    try {
        const jsonData = await response.json();
        if (jsonData.error_code != 0) {
            result.error = {
                message: jsonData.error_message,
                code: jsonData.error_code,
            };
            return result;
        }
        const decodedData = isEncrypted ? JSON.parse(crypto.decodeAES(ctx.secretKey, jsonData.data)) : jsonData;
        if (decodedData.error_code != 0) {
            result.error = {
                message: decodedData.error_message,
                code: decodedData.error_code,
            };
            return result;
        }
        result.data = decodedData.data;
    }
    catch (error) {
        logger.logger(ctx).error("Failed to parse response data:", error);
        result.error = {
            message: "Failed to parse response data",
        };
    }
    return result;
}
/**
 * Resolves a response into plain data, throwing {@link ZaloApiError} on failure.
 */
async function resolveResponse(ctx, res, cb, isEncrypted) {
    const result = await handleZaloResponse(ctx, res, isEncrypted);
    if (result.error)
        throw new errors.ZaloApiError(result.error.message, result.error.code);
    if (cb)
        return cb(result);
    return result.data;
}
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
function apiFactory() {
    return (callback) => {
        return (ctx, api) => {
            if (!context.isContextSession(ctx))
                throw new errors.ZaloApiError("Invalid context " + JSON.stringify(ctx, null, 2));
            const utils = {
                makeURL(baseURL, params, apiVersion) {
                    return http.makeURL(ctx, baseURL, params, apiVersion);
                },
                encodeAES(data) {
                    return crypto.encodeAES(ctx.secretKey, data);
                },
                request(url, options, raw) {
                    return http.request(ctx, url, options, raw);
                },
                logger: logger.logger(ctx),
                resolve: (res, cb, isEncrypted) => resolveResponse(ctx, res, cb, isEncrypted),
            };
            return callback(api, ctx, utils);
        };
    };
}

exports.apiFactory = apiFactory;
exports.handleZaloResponse = handleZaloResponse;
exports.resolveResponse = resolveResponse;
