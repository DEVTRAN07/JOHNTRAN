import { AvatarSize, type UserBasic } from "../models/index.js";
export type FindUserByUsernameResponse = UserBasic;
export declare const findUserByUsernameFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (username: string, avatarSize?: AvatarSize) => Promise<UserBasic>;
