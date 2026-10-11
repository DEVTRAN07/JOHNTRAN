'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getAutoDeleteChatFactory = factory.apiFactory()((api, _ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.conversation[0]}/api/conv/autodelete/getConvers`);
    /**
     * Get auto delete chat
     *
     * @throws {ZaloApiError}
     *
     */
    return async function getAutoDeleteChat() {
        const params = {};
        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        if (!encryptedParams)
            throw new errors.ZaloApiError("Failed to encrypt params");
        const response = await utils.request(utils.makeURL(serviceURL, { params: encryptedParams }), {
            method: "GET",
        });
        return utils.resolve(response);
    };
});

exports.getAutoDeleteChatFactory = getAutoDeleteChatFactory;
