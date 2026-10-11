import { ThreadType } from "../models/index.js";
export type AddUnreadMarkResponse = {
    data: {
        updateId: number;
    };
    status: number;
};
export declare const addUnreadMarkFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (threadId: string, type?: ThreadType) => Promise<AddUnreadMarkResponse>;
