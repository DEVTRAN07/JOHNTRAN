export type GetQRResponse = {
    [userId: string]: string;
};
export declare const getQRFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (userId: string | string[]) => Promise<GetQRResponse>;
