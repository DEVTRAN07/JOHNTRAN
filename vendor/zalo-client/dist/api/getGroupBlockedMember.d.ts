export type GetGroupBlockedMemberPayload = {
    /**
     * Page number (default: 1)
     */
    page?: number;
    /**
     * Number of items to retrieve (default: 50)
     */
    count?: number;
};
export type GetGroupBlockedMemberResponse = {
    blocked_members: {
        id: string;
        dName: string;
        zaloName: string;
        avatar: string;
        avatar_25: string;
        accountStatus: number;
        type: number;
    }[];
    has_more: number;
};
export declare const getGroupBlockedMemberFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: GetGroupBlockedMemberPayload, groupId: string) => Promise<GetGroupBlockedMemberResponse>;
