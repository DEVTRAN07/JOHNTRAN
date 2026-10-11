import { GroupMessage } from "../models/index.js";
export type GetGroupChatHistoryResponse = {
    lastActionId: string;
    lastActionIdOther: string;
    more: number;
    groupMsgs: GroupMessage[];
};
export declare const getGroupChatHistoryFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (groupId: string, count?: number) => Promise<GetGroupChatHistoryResponse>;
