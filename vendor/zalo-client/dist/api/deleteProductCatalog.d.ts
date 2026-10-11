export type DeleteProductCatalogPayload = {
    productIds: string | string[];
    catalogId: string;
};
export type DeleteProductCatalogResponse = {
    item: number[];
    version_ls_catalog: number;
    version_catalog: number;
};
export declare const deleteProductCatalogFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: DeleteProductCatalogPayload) => Promise<DeleteProductCatalogResponse>;
