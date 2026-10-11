import { DestType, ThreadType } from "../models/index.js";
export type SendTypingEventResponse = {
    status: number;
};
export declare const sendTypingEventFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (threadId: string, type?: ThreadType, destType?: DestType) => Promise<SendTypingEventResponse>;
