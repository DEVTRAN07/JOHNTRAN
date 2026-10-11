'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getGroupLinkDetailFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.group[0]}/api/group/link/detail`);
    /**
     * Get group link detail
     *
     * @param groupId The group id
     *
     * @throws {ZaloApiError}
     */
    return async function getGroupLinkDetail(groupId) {
        const params = {
            grid: groupId,
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

exports.getGroupLinkDetailFactory = getGroupLinkDetailFactory;
