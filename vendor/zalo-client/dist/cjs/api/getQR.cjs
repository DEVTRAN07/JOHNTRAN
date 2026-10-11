'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getQRFactory = factory.apiFactory()((api, _, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.friend[0]}/api/friend/mget-qr`);
    /**
     * Get QR code for users
     *
     * @param userId User ID or list of user IDs
     *
     * @throws {ZaloApiError}
     */
    return async function getQR(userId) {
        if (typeof userId == "string")
            userId = [userId];
        const params = {
            fids: userId,
        };
        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        if (!encryptedParams)
            throw new errors.ZaloApiError("Failed to encrypt params");
        const response = await utils.request(serviceURL, {
            method: "POST",
            body: new URLSearchParams({
                params: encryptedParams,
            }),
        });
        return utils.resolve(response);
    };
});

exports.getQRFactory = getQRFactory;
