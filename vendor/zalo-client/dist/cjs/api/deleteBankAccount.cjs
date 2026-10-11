'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const deleteBankAccountFactory = factory.apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.zimsg[0]}/api/transfer/delete`);
    /**
     * Delete bank account
     *
     * @param payload The payload containing the bank account information to delete
     *
     * @throws {ZaloApiError} When something went wrong, with `error.code`
     * - `114` - Invalid params
     * - `-265` - Bank account not exists
     * - `810` Internal Zalo error, maybe you're trying to delete a default bank account
     */
    return async function deleteBankAccount(payload) {
        const params = {
            account_id: payload.accountId,
            is_default: payload.isDefault,
            language: ctx.language,
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

exports.deleteBankAccountFactory = deleteBankAccountFactory;
