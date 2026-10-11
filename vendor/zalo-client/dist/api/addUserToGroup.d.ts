export type AddUserToGroupResponse = {
    errorMembers: string[];
    error_data: Record<string, string[]>;
};
export declare const addUserToGroupFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (memberId: string | string[], groupId: string) => Promise<AddUserToGroupResponse>;
