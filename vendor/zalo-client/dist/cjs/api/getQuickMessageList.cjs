'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getQuickMessageListFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.quick_message[0]}/api/quickmessage/list`);
    /**
     * Get quick message list
     *
     * @throws {ZaloApiError}
     */
    return async function getQuickMessageList() {
        const params = {
            version: 0,
            lang: 0,
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

exports.getQuickMessageListFactory = getQuickMessageListFactory;
