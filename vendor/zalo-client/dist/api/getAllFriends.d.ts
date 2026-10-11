import { AvatarSize, type User } from "../models/index.js";
export type GetAllFriendsResponse = User[];
export declare const getAllFriendsFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (count?: number, page?: number, avatarSize?: AvatarSize) => Promise<GetAllFriendsResponse>;
