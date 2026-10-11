'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const addGroupDeputyFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.group[0]}/api/group/admins/add`);
    /**
     * Add group deputy
     *
     * @param memberId user Id or list of user Ids
     * @param groupId group Id
     *
     * @throws {ZaloApiError}
     *
     */
    return async function addGroupDeputy(memberId, groupId) {
        if (!Array.isArray(memberId))
            memberId = [memberId];
        const params = {
            grid: groupId,
            members: memberId,
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

exports.addGroupDeputyFactory = addGroupDeputyFactory;
