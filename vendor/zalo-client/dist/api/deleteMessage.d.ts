import { ThreadType } from "../models/index.js";
export type DeleteMessageResponse = {
    status: number;
};
export type DeleteMessageDestination = {
    data: {
        cliMsgId: string;
        msgId: string;
        uidFrom: string;
    };
    threadId: string;
    type?: ThreadType;
};
export declare const deleteMessageFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (dest: DeleteMessageDestination, onlyMe?: boolean) => Promise<DeleteMessageResponse>;
