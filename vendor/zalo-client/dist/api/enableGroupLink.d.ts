export type EnableGroupLinkResponse = {
    link: string;
    expiration_date: number;
    enabled: number;
};
export declare const enableGroupLinkFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (groupId: string) => Promise<EnableGroupLinkResponse>;
