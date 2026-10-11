import type { QuickMessage, AttachmentSource } from "../models/index.js";
export type UpdateQuickMessagePayload = {
    keyword: string;
    title: string;
    media?: AttachmentSource;
};
export type UpdateQuickMessageResponse = {
    item: QuickMessage;
    version: number;
};
export declare const updateQuickMessageFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (updatePayload: UpdateQuickMessagePayload, itemId: number) => Promise<UpdateQuickMessageResponse>;
