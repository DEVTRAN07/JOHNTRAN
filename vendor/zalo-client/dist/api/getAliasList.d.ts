export type GetAliasListResponse = {
    items: {
        userId: string;
        alias: string;
    }[];
    updateTime: string;
};
export declare const getAliasListFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (count?: number, page?: number) => Promise<GetAliasListResponse>;
