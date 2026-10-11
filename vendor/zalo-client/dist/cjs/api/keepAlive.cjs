'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const keepAliveFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.chat[0]}/keepalive`);
    /**
     * Keep Alive?
     *
     * @throws {ZaloApiError}
     */
    return async function keepAlive() {
        const params = {
            imei: ctx.imei,
        };
        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        if (!encryptedParams)
            throw new errors.ZaloApiError("Failed to encrypt params");
        const response = await utils.request(utils.makeURL(serviceURL, { params: encryptedParams }), {
            method: "GET",
        });
        return utils.resolve(response, undefined, false);
    };
});

exports.keepAliveFactory = keepAliveFactory;
