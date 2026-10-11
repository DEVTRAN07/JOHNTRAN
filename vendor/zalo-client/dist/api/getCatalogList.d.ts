import type { CatalogItem } from "../models/index.js";
export type GetCatalogListPayload = {
    /**
     * Number of items to retrieve (default: 20)
     */
    limit?: number;
    lastProductId?: number;
    /**
     * Page number (default: 0)
     */
    page?: number;
};
export type GetCatalogListResponse = {
    items: CatalogItem[];
    version: number;
    has_more: number;
};
export declare const getCatalogListFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload?: GetCatalogListPayload) => Promise<GetCatalogListResponse>;
