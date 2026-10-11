import { ThreadType } from "../models/index.js";
export type ForwardMessagePayload = {
    message: string;
    ttl?: number;
    reference?: {
        id: string;
        ts: number;
        logSrcType: number;
        fwLvl: number;
    };
};
export type ForwardMessageSuccess = {
    clientId: string;
    msgId: string;
};
export type ForwardMessageFail = {
    clientId: string;
    error_code: string;
};
export type ForwardMessageResponse = {
    success: ForwardMessageSuccess[];
    fail: ForwardMessageFail[];
};
export declare const forwardMessageFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: ForwardMessagePayload, threadIds: string[], type?: ThreadType) => Promise<ForwardMessageResponse>;
