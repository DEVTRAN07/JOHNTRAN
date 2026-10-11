import type { StickerDetail } from "../models/index.js";
export type GetStickerCategoryDetailResponse = StickerDetail[];
export declare const getStickerCategoryDetailFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (cateId: number) => Promise<GetStickerCategoryDetailResponse>;
