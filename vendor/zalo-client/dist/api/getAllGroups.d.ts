export type GetAllGroupsResponse = {
    version: string;
    gridVerMap: {
        [groupId: string]: string;
    };
};
export declare const getAllGroupsFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetAllGroupsResponse>;
