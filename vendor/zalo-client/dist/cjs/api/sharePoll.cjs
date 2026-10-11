'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const sharePollFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.group[0]}/api/poll/share`);
    /**
     * Share a poll
     *
     * @param pollId poll id to share
     *
     * @throws {ZaloApiError}
     */
    return async function sharePoll(pollId) {
        const params = {
            poll_id: pollId,
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

exports.sharePollFactory = sharePollFactory;
