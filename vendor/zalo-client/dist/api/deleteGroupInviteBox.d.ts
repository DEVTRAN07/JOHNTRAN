export type DeleteGroupInviteBoxResponse = {
    delInvitaionIds: string[];
    errMap: {
        [groupId: string]: {
            err: number;
        };
    };
};
export declare const deleteGroupInviteBoxFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (groupId: string | string[], blockFutureInvite?: boolean) => Promise<DeleteGroupInviteBoxResponse>;
