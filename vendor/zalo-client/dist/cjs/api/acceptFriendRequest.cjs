'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const acceptFriendRequestFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.friend[0]}/api/friend/accept`);
    /**
     * Accept a friend request from a User
     *
     * @param friendId The friend ID to user request is accept
     *
     * @throws {ZaloApiError}
     */
    return async function acceptFriendRequest(friendId) {
        const params = {
            fid: friendId,
            language: ctx.language,
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

exports.acceptFriendRequestFactory = acceptFriendRequestFactory;
