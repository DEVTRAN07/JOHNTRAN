import type { ReminderGroup } from "../models/index.js";
export type GetReminderResponse = ReminderGroup;
export declare const getReminderFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (reminderId: string) => Promise<ReminderGroup>;
