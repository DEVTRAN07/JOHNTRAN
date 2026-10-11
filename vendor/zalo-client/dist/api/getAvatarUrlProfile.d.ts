import { AvatarSize } from "../models/index.js";
export type GetAvatarUrlProfileResponse = {
    [userId: string]: {
        avatar: string;
    };
};
export declare const getAvatarUrlProfileFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (friendIds: string | string[], avatarSize?: AvatarSize) => Promise<GetAvatarUrlProfileResponse>;
