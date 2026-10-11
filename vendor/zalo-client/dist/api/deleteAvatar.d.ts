export type DeleteAvatarResponse = {
    delPhotoIds: string[];
    errMap: {
        [key: string]: {
            err: number;
        };
    };
};
export declare const deleteAvatarFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (photoId: string | string[]) => Promise<DeleteAvatarResponse>;
