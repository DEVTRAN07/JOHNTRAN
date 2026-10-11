import type { GroupInfo, GroupTopic } from "../models/index.js";
export type GetGroupInviteBoxInfoPayload = {
    groupId: string;
    mpage?: number;
    mcount?: number;
};
export type GetGroupInviteBoxInfoResponse = {
    groupInfo: GroupInfo & {
        topic?: Omit<GroupTopic, "action">;
    };
    inviterInfo: {
        id: string;
        dName: string;
        zaloName: string;
        avatar: string;
        avatar_25: string;
        accountStatus: number;
        type: number;
    };
    grCreatorInfo: {
        id: string;
        dName: string;
        zaloName: string;
        avatar: string;
        avatar_25: string;
        accountStatus: number;
        type: number;
    };
    expiredTs: string;
    type: number;
};
export declare const getGroupInviteBoxInfoFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: GetGroupInviteBoxInfoPayload) => Promise<GetGroupInviteBoxInfoResponse>;
