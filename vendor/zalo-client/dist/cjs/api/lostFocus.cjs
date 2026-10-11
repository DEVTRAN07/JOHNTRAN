'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const lostFocusFactory = factory.apiFactory()((api, _ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.profile[0]}/api/social/profile/changefgtobg`);
    /**
     * Lost focus
     *
     * @throws {ZaloApiError}
     */
    return async function lostFocus() {
        const params = {};
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

exports.lostFocusFactory = lostFocusFactory;
