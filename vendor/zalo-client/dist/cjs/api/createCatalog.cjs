'use strict';

var errors = require('../core/errors.cjs');
var factory = require('../core/factory.cjs');

const createCatalogFactory = factory.apiFactory()((api, _, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.catalog[0]}/api/prodcatalog/catalog/create`);
    /**
     * Create catalog?
     *
     * @param catalogName catalog name
     *
     * @note this API is used for zBusiness
     * @throws {ZaloApiError}
     */
    return async function createCatalog(catalogName) {
        const params = {
            catalog_name: catalogName,
            catalog_photo: "",
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

exports.createCatalogFactory = createCatalogFactory;
