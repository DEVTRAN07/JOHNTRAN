'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getPollDetailFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.group[0]}/api/poll/detail`);
    /**
     * Get poll detail
     *
     * @param pollId Poll ID
     *
     * @throws {ZaloApiError}
     */
    return async function getPollDetail(pollId) {
        if (!pollId)
            throw new errors.ZaloApiError("Missing poll id");
        const params = {
            poll_id: pollId,
            imei: ctx.imei,
        };
        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        if (!encryptedParams)
            throw new errors.ZaloApiError("Failed to encrypt message");
        const response = await utils.request(serviceURL, {
            method: "POST",
            body: new URLSearchParams({
                params: encryptedParams,
            }),
        });
        return utils.resolve(response);
    };
});

exports.getPollDetailFactory = getPollDetailFactory;
