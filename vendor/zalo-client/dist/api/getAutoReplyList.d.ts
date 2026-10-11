import type { AutoReplyItem } from "../models/index.js";
export type GetAutoReplyListResponse = {
    item: AutoReplyItem[];
    version: number;
};
export declare const getAutoReplyListFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetAutoReplyListResponse>;
