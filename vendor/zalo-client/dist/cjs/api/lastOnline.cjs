'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const lastOnlineFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.profile[0]}/api/social/profile/lastOnline`);
    /**
     * Get last online
     *
     * @param uid User ID
     *
     * @throws {ZaloApiError}
     */
    return async function lastOnline(uid) {
        const params = {
            uid: uid,
            conv_type: 1,
            imei: ctx.imei,
        };
        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        if (!encryptedParams)
            throw new errors.ZaloApiError("Failed to encrypt params");
        const response = await utils.request(utils.makeURL(serviceURL, { params: encryptedParams }), {
            method: "GET",
        });
        return utils.resolve(response);
    };
});

exports.lastOnlineFactory = lastOnlineFactory;
