export type DeleteAutoReplyResponse = {
    item: number;
    version: number;
};
export declare const deleteAutoReplyFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (id: number) => Promise<DeleteAutoReplyResponse>;
