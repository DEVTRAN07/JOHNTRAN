import type { StickerBasic } from "../models/index.js";
export type SearchStickerResponse = StickerBasic[];
export declare const searchStickerFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (keyword: string, limit?: number) => Promise<SearchStickerResponse>;
