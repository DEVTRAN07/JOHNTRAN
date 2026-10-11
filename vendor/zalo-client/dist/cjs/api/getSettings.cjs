'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getSettingsFactory = factory.apiFactory()((_api, _ctx, utils) => {
    const serviceURL = utils.makeURL(`https://wpa.chat.zalo.me/api/setting/me`);
    /**
     * Get my account settings
     *
     * @throws {ZaloApiError}
     */
    return async function getSettings() {
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

exports.getSettingsFactory = getSettingsFactory;
