export type ReviewPendingMemberRequestPayload = {
    members: string | string[];
    isApprove: boolean;
};
export declare enum ReviewPendingMemberRequestStatus {
    SUCCESS = 0,
    NOT_IN_PENDING_LIST = 170,
    ALREADY_IN_GROUP = 178,
    INSUFFICIENT_PERMISSION = 166
}
export type ReviewPendingMemberRequestResponse = {
    [memberId: string]: ReviewPendingMemberRequestStatus;
};
export declare const reviewPendingMemberRequestFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: ReviewPendingMemberRequestPayload, groupId: string) => Promise<ReviewPendingMemberRequestResponse>;
