'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const getListBankFactory = factory.apiFactory()((api, _ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.zimsg[0]}/api/transfer/conf`);
    /**
     * Get list bank
     *
     * @throws {ZaloApiError}
     */
    return async function getListBank() {
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

exports.getListBankFactory = getListBankFactory;
