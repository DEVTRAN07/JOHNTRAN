import type { ZBusinessPackage } from "../models/ZBusiness.js";
export type SentFriendRequestInfo = {
    userId: string;
    zaloName: string;
    displayName: string;
    avatar: string;
    globalId: string;
    bizPkg: ZBusinessPackage;
    fReqInfo: {
        message: string;
        src: number;
        time: number;
    };
};
export type GetSentFriendRequestResponse = {
    [userId: string]: SentFriendRequestInfo;
};
export declare const getSentFriendRequestFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetSentFriendRequestResponse>;
