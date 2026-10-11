export type GetArchivedChatListResponse = {
    items: unknown[];
    version: number;
};
export declare const getArchivedChatListFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetArchivedChatListResponse>;
