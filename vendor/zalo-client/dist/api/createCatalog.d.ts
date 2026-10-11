import type { CatalogItem } from "../models/index.js";
export type CreateCatalogResponse = {
    item: CatalogItem;
    version_ls_catalog: number;
    version_catalog: number;
};
export declare const createCatalogFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (catalogName: string) => Promise<CreateCatalogResponse>;
