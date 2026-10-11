import type { User } from "../models/index.js";
export type GetCloseFriendsResponse = User[];
export declare const getCloseFriendsFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetCloseFriendsResponse>;
