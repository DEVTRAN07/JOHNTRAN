export type GetRelatedFriendGroupResponse = {
    groupRelateds: {
        [friendId: string]: string[];
    };
};
export declare const getRelatedFriendGroupFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (friendId: string | string[]) => Promise<GetRelatedFriendGroupResponse>;
