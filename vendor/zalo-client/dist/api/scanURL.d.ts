export type ScanURLResponse = {
    isSafe: boolean;
};
export declare const scanURLFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (url: string) => Promise<ScanURLResponse>;
