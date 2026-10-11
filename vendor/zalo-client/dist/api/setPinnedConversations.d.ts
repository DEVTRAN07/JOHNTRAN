import { ThreadType } from "../models/index.js";
export type SetPinnedConversationsResponse = "";
export declare const setPinnedConversationsFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (pinned: boolean, threadId: string | string[], type?: ThreadType) => Promise<"">;
