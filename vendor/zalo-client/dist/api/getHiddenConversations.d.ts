export type GetHiddenConversationsResponse = {
    pin: string;
    threads: {
        /**
         * 1: true, 0: false
         */
        is_group: number;
        thread_id: string;
    }[];
};
export declare const getHiddenConversationsFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetHiddenConversationsResponse>;
