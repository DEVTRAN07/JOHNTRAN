import type { Gender, ZBusinessPackage } from "../models/index.js";
export declare enum FriendRecommendationsType {
    RecommendedFriend = 1,
    ReceivedFriendRequest = 2
}
export type FriendRecommendationsCollapseMsgListConfig = {
    collapseId: number;
    collapseXItem: number;
    collapseYItem: number;
};
export type FriendRecommendationsDataInfo = {
    userId: string;
    zaloName: string;
    displayName: string;
    avatar: string;
    phoneNumber: string;
    status: string;
    gender: Gender;
    dob: number;
    type: number;
    recommType: FriendRecommendationsType;
    recommSrc: number;
    recommTime: number;
    recommInfo: {
        suggestWay: number;
        source: number;
        message: string;
        customText: string | null;
    };
    bizPkg: ZBusinessPackage;
    isSeenFriendReq: boolean;
};
export type FriendRecommendationsRecommItem = {
    recommItemType: number;
    dataInfo: FriendRecommendationsDataInfo;
};
export type GetFriendRecommendationsResponse = {
    expiredDuration: number;
    collapseMsgListConfig: FriendRecommendationsCollapseMsgListConfig;
    recommItems: FriendRecommendationsRecommItem[];
};
export declare const getFriendRecommendationsFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetFriendRecommendationsResponse>;
