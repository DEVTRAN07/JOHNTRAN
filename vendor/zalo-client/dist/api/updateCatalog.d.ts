import type { CatalogItem } from "../models/index.js";
export type UpdateCatalogPayload = {
    catalogId: string;
    catalogName: string;
};
export type UpdateCatalogResponse = {
    item: CatalogItem;
    version_ls_catalog: number;
    version_catalog: number;
};
export declare const updateCatalogFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: UpdateCatalogPayload) => Promise<UpdateCatalogResponse>;
