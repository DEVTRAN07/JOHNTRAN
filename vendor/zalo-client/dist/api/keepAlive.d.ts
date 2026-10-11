export type KeepAliveResponse = {
    config_vesion: number;
};
export declare const keepAliveFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<KeepAliveResponse>;
