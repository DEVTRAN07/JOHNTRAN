'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const removeFriendAliasFactory = factory.apiFactory()((api, _ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.alias[0]}/api/alias/remove`);
    /**
     * Remove friend's alias
     *
     * @param friendId friend id
     *
     * @throws {ZaloApiError}
     */
    return async function removeFriendAlias(friendId) {
        const params = {
            friendId: friendId,
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

exports.removeFriendAliasFactory = removeFriendAliasFactory;
