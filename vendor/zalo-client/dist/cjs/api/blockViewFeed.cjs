'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const blockViewFeedFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.friend[0]}/api/friend/feed/block`);
    /**
     * Block/Unblock friend view feed by ID
     *
     * @param isBlockFeed Boolean to block/unblock view feed
     * @param userId User ID to block/unblock view feed
     *
     * @throws {ZaloApiError}
     */
    return async function blockViewFeed(isBlockFeed, userId) {
        const params = {
            fid: userId,
            isBlockFeed: isBlockFeed ? 1 : 0,
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

exports.blockViewFeedFactory = blockViewFeedFactory;
