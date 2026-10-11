export type GetAvatarListResponse = {
    albumId: string;
    nextPhotoId: string;
    hasMore: number;
    photos: {
        photoId: string;
        thumbnail: string;
        url: string;
        bkUrl: string;
    }[];
};
export declare const getAvatarListFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (count?: number, page?: number) => Promise<GetAvatarListResponse>;
