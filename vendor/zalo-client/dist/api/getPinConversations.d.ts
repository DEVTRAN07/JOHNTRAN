export type GetPinConversationsResponse = {
    conversations: string[];
    version: number;
};
export declare const getPinConversationsFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetPinConversationsResponse>;
