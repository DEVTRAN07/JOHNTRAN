export type GetFullAvatarResponse = {
    bk_full_avatar: string;
    full_avatar: string;
};
export declare const getFullAvatarFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (friendId: string) => Promise<GetFullAvatarResponse>;
