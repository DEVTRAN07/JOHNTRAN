import { ThreadType } from "../models/index.js";
export type RemoveUnreadMarkResponse = {
    data: {
        updateId: number;
    };
    status: number;
};
export declare const removeUnreadMarkFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (threadId: string, type?: ThreadType) => Promise<RemoveUnreadMarkResponse>;
