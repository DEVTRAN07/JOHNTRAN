import type { AutoReplyItem, AutoReplyScope } from "../models/index.js";
export type UpdateAutoReplyPayload = {
    id: number;
    content: string;
    isEnable: boolean;
    startTime: number;
    endTime: number;
    scope: AutoReplyScope;
    uids?: string | string[];
};
export type UpdateAutoReplyResponse = {
    item: AutoReplyItem;
    version: number;
};
export declare const updateAutoReplyFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: UpdateAutoReplyPayload) => Promise<UpdateAutoReplyResponse>;
