'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const deleteCatalogFactory = factory.apiFactory()((api, _, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.catalog[0]}/api/prodcatalog/catalog/delete`);
    /**
     * Delete catalog?
     *
     * @param catalogId catalog id
     *
     * @note this API is used for zBusiness
     * @throws {ZaloApiError}
     */
    return async function deleteCatalog(catalogId) {
        const params = {
            catalog_id: catalogId,
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

exports.deleteCatalogFactory = deleteCatalogFactory;
