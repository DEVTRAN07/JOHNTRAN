export type RemoveQuickMessageResponse = {
    itemIds: number[];
    version: number;
};
export declare const removeQuickMessageFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (itemIds: number | number[]) => Promise<RemoveQuickMessageResponse>;
