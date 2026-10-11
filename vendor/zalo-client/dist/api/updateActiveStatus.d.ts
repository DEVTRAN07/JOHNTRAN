export type UpdateActiveStatusResponse = {
    status: boolean;
};
export declare const updateActiveStatusFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (active: boolean) => Promise<UpdateActiveStatusResponse>;
