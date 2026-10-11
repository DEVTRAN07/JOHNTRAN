export type RemoveUserFromGroupResponse = {
    errorMembers: string[];
};
export declare const removeUserFromGroupFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (memberId: string | string[], groupId: string) => Promise<RemoveUserFromGroupResponse>;
