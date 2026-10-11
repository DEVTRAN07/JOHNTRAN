'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const joinGroupInviteBoxFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.group[0]}/api/group/inv-box/join`);
    /**
     * Join group invite box
     *
     * @param groupId - The group id
     *
     * @throws {ZaloApiError}
     */
    return async function joinGroupInviteBox(groupId) {
        const params = {
            grid: groupId,
            lang: ctx.language,
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

exports.joinGroupInviteBoxFactory = joinGroupInviteBoxFactory;
