import { AvatarSize, type UserBasic } from "../models/index.js";
export type FindUserResponse = UserBasic;
export declare const findUserFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (phoneNumber: string, avatarSize?: AvatarSize) => Promise<UserBasic>;
