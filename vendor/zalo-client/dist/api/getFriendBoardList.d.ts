export type GetFriendBoardListResponse = {
    data: string[];
    version: number;
};
export declare const getFriendBoardListFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (conversationId: string) => Promise<GetFriendBoardListResponse>;
