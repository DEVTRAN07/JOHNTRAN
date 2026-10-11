export type ChangeGroupOwnerResponse = {
    time: number;
};
export declare const changeGroupOwnerFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (memberId: string, groupId: string) => Promise<ChangeGroupOwnerResponse>;
