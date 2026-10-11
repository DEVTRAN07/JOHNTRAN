'use strict';

var errors = require('../core/errors.cjs');
var crypto = require('../core/crypto.cjs');
var factory = require('../core/factory.cjs');

const updateHiddenConversPinFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.conversation[0]}/api/hiddenconvers/update-pin`);
    const pinRegex = /^\d{4}$/;
    /**
     * Update hidden conversation pin
     *
     * @param pin The pin to update (must be a 4-digit number between 0000-9999)
     *
     * @throws {ZaloApiError}
     */
    return async function updateHiddenConversPin(pin) {
        if (!pinRegex.test(pin)) {
            throw new errors.ZaloApiError("Pin must be a 4-digit number between 0000-9999");
        }
        const encryptedPin = crypto.encryptPin(pin);
        const params = {
            new_pin: encryptedPin,
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

exports.updateHiddenConversPinFactory = updateHiddenConversPinFactory;
