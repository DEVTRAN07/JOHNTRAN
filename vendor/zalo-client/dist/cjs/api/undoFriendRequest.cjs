'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const undoFriendRequestFactory = factory.apiFactory()((api, _ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.friend[0]}/api/friend/undo`);
    /**
     * Undo send a friend request to a user.
     *
     * @param options
     *
     * @throws {ZaloApiError}
     */
    return async function undoFriendRequest(friendId) {
        const params = {
            fid: friendId,
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

exports.undoFriendRequestFactory = undoFriendRequestFactory;
