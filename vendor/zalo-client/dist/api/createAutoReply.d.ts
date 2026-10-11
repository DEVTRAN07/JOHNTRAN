import type { AutoReplyItem, AutoReplyScope } from "../models/index.js";
export type CreateAutoReplyPayload = {
    content: string;
    isEnable: boolean;
    startTime: number;
    endTime: number;
    scope: AutoReplyScope;
    uids?: string | string[];
};
export type CreateAutoReplyResponse = {
    item: AutoReplyItem;
    version: number;
};
export declare const createAutoReplyFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: CreateAutoReplyPayload) => Promise<CreateAutoReplyResponse>;
