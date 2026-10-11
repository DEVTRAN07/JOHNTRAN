'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getArchivedChatListFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.label[0]}/api/archivedchat/list`);
    /**
     * Get arcnived chat list
     *
     * @throws {ZaloApiError}
     */
    return async function getArchivedChatList() {
        const params = {
            version: 1,
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

exports.getArchivedChatListFactory = getArchivedChatListFactory;
