import type { ThreadType } from "../models/Enum.js";
export type UpdateArchivedChatListTarget = {
    id: string;
    type: ThreadType;
};
export type UpdateArchivedChatListResponse = {
    needResync: boolean;
    version: number;
};
export declare const updateArchivedChatListFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (isArchived: boolean, conversations: UpdateArchivedChatListTarget | UpdateArchivedChatListTarget[]) => Promise<UpdateArchivedChatListResponse>;
