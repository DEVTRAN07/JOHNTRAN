import type { User } from "../models/index.js";
export type FetchAccountInfoResponse = {
    profile: User;
};
export declare const fetchAccountInfoFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<FetchAccountInfoResponse>;
