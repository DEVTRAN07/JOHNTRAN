export type GetFriendOnlinesStatus = {
    userId: string;
    status: string;
};
export type GetFriendOnlinesResponse = {
    predefine: string[];
    ownerStatus: string;
    onlines: GetFriendOnlinesStatus[];
};
export declare const getFriendOnlinesFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetFriendOnlinesResponse>;
