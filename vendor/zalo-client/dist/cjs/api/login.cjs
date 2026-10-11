'use strict';

var errors = require('../core/errors.cjs');
var crypto = require('../core/crypto.cjs');
var http = require('../core/http.cjs');
var logger = require('../core/logger.cjs');

async function login(ctx, encryptParams) {
    const encryptedParams = await getEncryptParam(ctx, encryptParams, "getlogininfo");
    try {
        const response = await http.request(ctx, http.makeURL(ctx, "https://wpa.chat.zalo.me/api/login/getLoginInfo", Object.assign(Object.assign({}, encryptedParams.params), { nretry: 0 })));
        if (!response.ok)
            throw new errors.ZaloApiError("Failed to fetch login info: " + response.statusText);
        const data = await response.json();
        if (encryptedParams.enk) {
            const decryptedData = crypto.decryptResp(encryptedParams.enk, data.data);
            return decryptedData != null && typeof decryptedData != "string" ? decryptedData : null;
        }
        return null;
    }
    catch (error) {
        logger.logger(ctx).error("Login failed:", error);
        throw error;
    }
}
async function getServerInfo(ctx, encryptParams) {
    const encryptedParams = await getEncryptParam(ctx, encryptParams, "getserverinfo");
    if (!encryptedParams.params.signkey || typeof encryptedParams.params.signkey !== "string")
        throw new errors.ZaloApiError("Missing signkey");
    const response = await http.request(ctx, http.makeURL(ctx, "https://wpa.chat.zalo.me/api/login/getServerInfo", {
        imei: ctx.imei,
        type: ctx.API_TYPE,
        client_version: ctx.API_VERSION,
        computer_name: "Web",
        signkey: encryptedParams.params.signkey,
    }, false));
    if (!response.ok)
        throw new errors.ZaloApiError("Failed to fetch server info: " + response.statusText);
    const data = await response.json();
    if (data.data == null)
        throw new errors.ZaloApiError("Failed to fetch server info: " + data.error_message);
    return data.data;
}
async function getEncryptParam(ctx, encryptParams, type) {
    const params = {};
    const data = {
        computer_name: "Web",
        imei: ctx.imei,
        language: ctx.language,
        ts: Date.now(),
    };
    const encryptedData = await _encryptParam(ctx, data, encryptParams);
    if (encryptedData == null)
        Object.assign(params, data);
    else {
        const { encrypted_params, encrypted_data } = encryptedData;
        Object.assign(params, encrypted_params);
        params.params = encrypted_data;
    }
    params.type = ctx.API_TYPE;
    params.client_version = ctx.API_VERSION;
    params.signkey =
        type == "getserverinfo"
            ? crypto.getSignKey(type, {
                imei: ctx.imei,
                type: ctx.API_TYPE,
                client_version: ctx.API_VERSION,
                computer_name: "Web",
            })
            : crypto.getSignKey(type, params);
    return {
        params,
        enk: encryptedData ? encryptedData.enk : null,
    };
}
async function _encryptParam(ctx, data, encryptParams) {
    if (encryptParams) {
        const encryptor = new crypto.ParamsEncryptor({
            type: ctx.API_TYPE,
            imei: data.imei,
            firstLaunchTime: Date.now(),
        });
        try {
            const stringifiedData = JSON.stringify(data);
            const encryptedKey = encryptor.getEncryptKey();
            const encodedData = crypto.ParamsEncryptor.encodeAES(encryptedKey, stringifiedData, "base64", false);
            const params = encryptor.getParams();
            return params
                ? {
                    encrypted_data: encodedData,
                    encrypted_params: params,
                    enk: encryptedKey,
                }
                : null;
        }
        catch (error) {
            throw new errors.ZaloApiError("Failed to encrypt params: " + error);
        }
    }
    return null;
}

exports.getServerInfo = getServerInfo;
exports.login = login;
