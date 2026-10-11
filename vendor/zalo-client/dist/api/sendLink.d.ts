import { ThreadType } from "../models/index.js";
export type SendLinkOptions = {
    msg?: string;
    link: string;
    ttl?: number;
};
export type SendLinkResponse = {
    msgId: string;
};
export declare const sendLinkFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (options: SendLinkOptions, threadId: string, type?: ThreadType) => Promise<SendLinkResponse>;
