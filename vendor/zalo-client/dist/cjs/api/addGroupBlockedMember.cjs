'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const addGroupBlockedMemberFactory = factory.apiFactory()((api, _, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.group[0]}/api/group/blockedmems/add`);
    /**
     * Add group blocked member
     *
     * @param memberId member id(s)
     * @param groupId group id
     *
     * @throws {ZaloApiError}
     */
    return async function addGroupBlockedMember(memberId, groupId) {
        if (!Array.isArray(memberId))
            memberId = [memberId];
        const params = {
            grid: groupId,
            members: memberId,
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

exports.addGroupBlockedMemberFactory = addGroupBlockedMemberFactory;
