import type { AttachmentSource } from "../models/index.js";
export type UploadProductPhotoPayload = {
    file: AttachmentSource;
};
export type UploadProductPhotoResponse = {
    normalUrl: string;
    photoId: string;
    finished: number;
    hdUrl: string;
    thumbUrl: string;
    clientFileId: number;
    chunkId: number;
};
export declare const uploadProductPhotoFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: UploadProductPhotoPayload) => Promise<UploadProductPhotoResponse>;
