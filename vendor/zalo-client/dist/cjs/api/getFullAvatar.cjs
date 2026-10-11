'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getFullAvatarFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.profile[0]}/api/social/profile/avatar`);
    /**
     * Get full avatar
     *
     * @param friendId friend id
     *
     * @throws {ZaloApiError}
     */
    return async function getFullAvatar(friendId) {
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

exports.getFullAvatarFactory = getFullAvatarFactory;
