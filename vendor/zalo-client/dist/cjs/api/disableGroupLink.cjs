'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const disableGroupLinkFactory = factory.apiFactory()((api, _ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.group[0]}/api/group/link/disable`);
    /**
     * Disable group link
     *
     * @param groupId The group id
     *
     * @throws {ZaloApiError}
     */
    return async function disableGroupLink(groupId) {
        const params = {
            grid: groupId,
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

exports.disableGroupLinkFactory = disableGroupLinkFactory;
