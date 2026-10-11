'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getFriendRequestStatusFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.friend[0]}/api/friend/reqstatus`);
    /**
     * Get friend request status
     *
     * @param friendId friend id
     *
     * @throws {ZaloApiError}
     */
    return async function getFriendRequestStatus(friendId) {
        const params = {
            fid: friendId,
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

exports.getFriendRequestStatusFactory = getFriendRequestStatusFactory;
