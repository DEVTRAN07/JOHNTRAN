export type GetFriendRequestStatusResponse = {
    addFriendPrivacy: number;
    isSeenFriendReq: boolean;
    is_friend: number;
    is_requested: number;
    is_requesting: number;
};
export declare const getFriendRequestStatusFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (friendId: string) => Promise<GetFriendRequestStatusResponse>;
