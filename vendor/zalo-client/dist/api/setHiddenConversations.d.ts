import { ThreadType } from "../models/index.js";
export type SetHiddenConversationsResponse = "";
export declare const setHiddenConversationsFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (hidden: boolean, threadId: string | string[], type?: ThreadType) => Promise<"">;
