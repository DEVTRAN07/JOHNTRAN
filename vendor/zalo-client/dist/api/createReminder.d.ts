import type { ReminderGroup, ReminderUser } from "../models/index.js";
import { ReminderRepeatMode, ThreadType } from "../models/index.js";
export type CreateReminderOptions = {
    title: string;
    emoji?: string;
    startTime?: number;
    repeat?: ReminderRepeatMode;
};
export type CreateReminderUser = ReminderUser;
export type CreateReminderGroup = Omit<ReminderGroup, "responseMem">;
export type CreateReminderResponse = CreateReminderUser | CreateReminderGroup;
export declare const createReminderFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (options: CreateReminderOptions, threadId: string, type?: ThreadType) => Promise<CreateReminderResponse>;
