import { ZaloApiError } from "../core/errors.js";
import { apiFactory } from "../core/factory.js";
export const getListDeviceFactory = apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.aext[0]}/api/devices/linked`);
    /**
     * Get list device
     *
     * @throws {ZaloApiError}
     */
    return async function getListDevice() {
        const params = {
            imei: ctx.imei,
        };
        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt params");
        const response = await utils.request(utils.makeURL(serviceURL, { params: encryptedParams }), {
            method: "GET",
        });
        return utils.resolve(response);
    };
});
