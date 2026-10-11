import { AvatarSize, type UserBasic } from "../models/index.js";
export type GetMultiUsersByPhonesResponse = {
    [phoneNumber: string]: UserBasic;
};
export declare const getMultiUsersByPhonesFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (phoneNumbers: string | string[], avatarSize?: AvatarSize) => Promise<GetMultiUsersByPhonesResponse>;
