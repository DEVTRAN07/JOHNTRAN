export type ChangeGroupNameResponse = {
    status: number;
};
export declare const changeGroupNameFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (name: string, groupId: string) => Promise<ChangeGroupNameResponse>;
