'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const updateCatalogFactory = factory.apiFactory()((api, _, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.catalog[0]}/api/prodcatalog/catalog/update`);
    /**
     * Update catalog?
     *
     * @param payload payload
     *
     * @note this API is used for zBusiness
     * @throws {ZaloApiError}
     */
    return async function updateCatalog(payload) {
        const params = {
            catalog_id: payload.catalogId,
            catalog_name: payload.catalogName,
            catalog_photo: "", // "" is defaut don't upload photo
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

exports.updateCatalogFactory = updateCatalogFactory;
