import { apiFactory } from "../core/factory.js";
export const getOwnIdFactory = apiFactory()((_, ctx) => {
    return () => ctx.uid;
});
