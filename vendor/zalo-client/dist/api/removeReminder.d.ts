import { ThreadType } from "../models/index.js";
export type RemoveReminderResponse = "" | number;
export declare const removeReminderFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (reminderId: string, threadId: string, type?: ThreadType) => Promise<RemoveReminderResponse>;
