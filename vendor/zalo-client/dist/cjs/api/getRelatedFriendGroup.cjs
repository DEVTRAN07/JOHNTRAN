'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getRelatedFriendGroupFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.friend[0]}/api/friend/group/related`);
    /**
     * Get related friend group
     *
     * @param friendId friend ids
     *
     * @note this API is used for zBusiness
     * @throws {ZaloApiError}
     */
    return async function getRelatedFriendGroup(friendId) {
        const friendIds = Array.isArray(friendId) ? friendId : [friendId];
        const params = {
            friend_ids: JSON.stringify(friendIds),
            imei: ctx.imei,
        };
        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        if (!encryptedParams)
            throw new errors.ZaloApiError("Failed to encrypt params");
        const response = await utils.request(serviceURL, {
            method: "POST",
            body: new URLSearchParams({
                params: encryptedParams,
            }),
        });
        return utils.resolve(response);
    };
});

exports.getRelatedFriendGroupFactory = getRelatedFriendGroupFactory;
