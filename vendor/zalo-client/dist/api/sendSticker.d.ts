import { ThreadType } from "../models/index.js";
export type SendStickerPayload = {
    id: number;
    cateId: number;
    type: number;
};
export type SendStickerResponse = {
    msgId: number;
};
export declare const sendStickerFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (sticker: SendStickerPayload, threadId: string, type?: ThreadType) => Promise<SendStickerResponse>;
