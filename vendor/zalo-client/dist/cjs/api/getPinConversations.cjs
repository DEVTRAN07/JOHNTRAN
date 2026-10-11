'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getPinConversationsFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.conversation[0]}/api/pinconvers/list`);
    /**
     * Get pin conversations
     *
     * @throws {ZaloApiError}
     */
    return async function getPinConversations() {
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

exports.getPinConversationsFactory = getPinConversationsFactory;
