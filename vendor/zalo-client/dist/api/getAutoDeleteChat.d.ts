export type GetAutoDeleteChatResponse = {
    convers: {
        destId: string;
        isGroup: boolean;
        ttl: number;
        createdAt: number;
    }[];
};
export declare const getAutoDeleteChatFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetAutoDeleteChatResponse>;
