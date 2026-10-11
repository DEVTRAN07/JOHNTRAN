'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getMuteFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.profile[0]}/api/social/profile/getmute`);
    /**
     * Get mute
     *
     * @throws {ZaloApiError}
     */
    return async function getMute() {
        const params = {
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

exports.getMuteFactory = getMuteFactory;
