import { ZaloApiError } from "../core/errors.js";
import { apiFactory } from "../core/factory.js";
export const removeFriendFactory = apiFactory()((api, ctx, utils) => {
    const serviceURL = utils.makeURL(`${api.zpwServiceMap.friend[0]}/api/friend/remove`);
    /**
     * Remove friend
     *
     * @param friendId - ID of the friend to remove
     *
     * @throws {ZaloApiError}
     */
    return async function removeFriend(friendId) {
        const params = {
            fid: friendId,
            imei: ctx.imei,
        };
        const encryptedParams = utils.encodeAES(JSON.stringify(params));
        if (!encryptedParams)
            throw new ZaloApiError("Failed to encrypt params");
        const response = await utils.request(serviceURL, {
            method: "POST",
            body: new URLSearchParams({
                params: encryptedParams,
            }),
        });
        return utils.resolve(response);
    };
});
