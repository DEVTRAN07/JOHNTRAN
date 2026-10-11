import { apiFactory } from "../core/factory.js";
export const getContextFactory = apiFactory()((_, ctx) => {
    return () => ctx;
});
