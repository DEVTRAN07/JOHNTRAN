import type { QuickMessage } from "../models/index.js";
export type GetQuickMessageListResponse = {
    cursor: number;
    version: number;
    items: QuickMessage[];
};
export declare const getQuickMessageListFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetQuickMessageListResponse>;
