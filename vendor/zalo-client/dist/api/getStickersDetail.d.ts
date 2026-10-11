import type { StickerDetail } from "../models/index.js";
export type StickerDetailResponse = StickerDetail[];
export declare const getStickersDetailFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (stickerIds: number | number[]) => Promise<StickerDetailResponse>;
