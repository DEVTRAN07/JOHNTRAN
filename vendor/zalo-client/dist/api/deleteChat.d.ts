import { ThreadType } from "../models/index.js";
export type DeleteChatResponse = {
    status: number;
};
export type DeleteChatLastMessage = {
    /**
     * Last message owner ID to delete backwards
     */
    ownerId: string;
    /**
     * Last message client ID to delete backwards
     */
    cliMsgId: string;
    /**
     * Last message global ID to delete backwards
     */
    globalMsgId: string;
};
export declare const deleteChatFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (lastMessage: DeleteChatLastMessage, threadId: string, type?: ThreadType) => Promise<DeleteChatResponse>;
