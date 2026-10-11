export type LeaveGroupResponse = {
    memberError: unknown[];
};
export declare const leaveGroupFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (groupId: string, silent?: boolean) => Promise<LeaveGroupResponse>;
