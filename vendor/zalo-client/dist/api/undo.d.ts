import { ThreadType } from "../models/index.js";
export type UndoPayload = {
    msgId: string | number;
    cliMsgId: string | number;
};
export type UndoResponse = {
    status: number;
};
export declare const undoFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: UndoPayload, threadId: string, type?: ThreadType) => Promise<UndoResponse>;
