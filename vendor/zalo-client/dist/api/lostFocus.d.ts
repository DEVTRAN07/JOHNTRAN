export type LostFocusResponse = {
    status: boolean;
};
export declare const lostFocusFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<LostFocusResponse>;
