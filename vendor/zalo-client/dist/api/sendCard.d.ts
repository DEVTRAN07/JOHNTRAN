import { ThreadType } from "../models/index.js";
export type SendCardOptions = {
    userId: string;
    phoneNumber?: string;
    ttl?: number;
};
export type SendCardResponse = {
    msgId: number;
};
export declare const sendCardFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (options: SendCardOptions, threadId: string, type?: ThreadType) => Promise<SendCardResponse>;
