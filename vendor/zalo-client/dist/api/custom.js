import {} from "../core/context.js";
import { apiFactory } from "../core/factory.js";
/* eslint-disable */
export const customFactory = apiFactory()((api, ctx, utils) => {
    return function custom(name, callback) {
        Object.defineProperty(api, name, {
            value: function (props) {
                return callback({ ctx, utils, props });
            },
            writable: false,
            enumerable: false,
            configurable: false,
        });
    };
});
