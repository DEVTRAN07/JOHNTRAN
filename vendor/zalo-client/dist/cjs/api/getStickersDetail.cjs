'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getStickersDetailFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.sticker}/api/message/sticker/sticker_detail`);
    /**
     * Get stickers detail by sticker IDs
     *
     * @param stickerIds Sticker IDs to search for
     *
     * @throws {ZaloApiError}
     */
    return async function getStickersDetail(stickerIds) {
        if (!stickerIds)
            throw new errors.ZaloApiError("Missing sticker id");
        if (!Array.isArray(stickerIds))
            stickerIds = [stickerIds];
        if (stickerIds.length == 0)
            throw new errors.ZaloApiError("Missing sticker id");
        const stickers = [];
        const tasks = stickerIds.map((stickerId) => getStickerDetail(stickerId));
        const tasksResult = await Promise.allSettled(tasks);
        tasksResult.forEach((result) => {
            if (result.status === "fulfilled")
                stickers.push(result.value);
        });
        return stickers;
    };
    async function getStickerDetail(stickerId) {
        const params = {
            sid: stickerId,
        };
        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        if (!encryptedParams)
            throw new errors.ZaloApiError("Failed to encrypt message");
        const response = await utils.request(utils.makeURL(serviceURL, {
            params: encryptedParams,
        }));
        return factory.resolveResponse(ctx, response);
    }
});

exports.getStickersDetailFactory = getStickersDetailFactory;
