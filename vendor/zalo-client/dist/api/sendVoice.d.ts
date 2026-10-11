import { ThreadType } from "../models/index.js";
export type SendVoiceOptions = {
    voiceUrl: string;
    /**
     * Time to live in milliseconds (default: 0)
     */
    ttl?: number;
};
export type SendVoiceResponse = {
    msgId: string;
};
export declare const sendVoiceFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (options: SendVoiceOptions, threadId: string, type?: ThreadType) => Promise<SendVoiceResponse>;
