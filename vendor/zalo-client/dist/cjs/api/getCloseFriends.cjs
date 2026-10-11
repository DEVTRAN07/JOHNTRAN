'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getCloseFriendsFactory = factory.apiFactory()((api, _ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.profile[0]}/api/social/friend/getclosedfriends`);
    /**
     * Get close friends
     *
     * @throws {ZaloApiError}
     */
    return async function getCloseFriends() {
        const params = {};
        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        if (!encryptedParams)
            throw new errors.ZaloApiError("Failed to encrypt params");
        const response = await utils.request(utils.makeURL(serviceURL, { params: encryptedParams }), {
            method: "GET",
        });
        return utils.resolve(response);
    };
});

exports.getCloseFriendsFactory = getCloseFriendsFactory;
