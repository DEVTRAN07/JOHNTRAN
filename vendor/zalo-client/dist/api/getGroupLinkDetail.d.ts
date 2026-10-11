export type GetGroupLinkDetailResponse = {
    link?: string;
    expiration_date?: number;
    /**
     * 1: enabled, 0: disabled
     */
    enabled: number;
};
export declare const getGroupLinkDetailFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (groupId: string) => Promise<GetGroupLinkDetailResponse>;
