export type LastOnlineResponse = {
    settings: {
        show_online_status: boolean;
    };
    lastOnline: number;
};
export declare const lastOnlineFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (uid: string) => Promise<LastOnlineResponse>;
