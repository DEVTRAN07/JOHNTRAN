export type GetPendingGroupMembersUserInfo = {
    uid: string;
    dpn: string;
    avatar: string;
    user_submit: null;
};
export type GetPendingGroupMembersResponse = {
    time: number;
    users: GetPendingGroupMembersUserInfo[];
};
export declare const getPendingGroupMembersFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (groupId: string) => Promise<GetPendingGroupMembersResponse>;
