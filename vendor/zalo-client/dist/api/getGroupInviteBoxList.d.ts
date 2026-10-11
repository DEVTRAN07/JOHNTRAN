import type { GroupInfo } from "../models/index.js";
export type GetGroupInviteBoxListPayload = {
    mpage?: number;
    page?: number;
    invPerPage?: number;
    mcount?: number;
};
export type GetGroupInviteBoxListResponse = {
    invitations: {
        groupInfo: GroupInfo;
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
        /**
         * Expired timestamp max 7 days
         */
        expiredTs: string;
        type: number;
    }[];
    total: number;
    hasMore: boolean;
};
export declare const getGroupInviteBoxListFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload?: GetGroupInviteBoxListPayload) => Promise<GetGroupInviteBoxListResponse>;
