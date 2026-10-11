import type { PollDetail } from "../models/index.js";
export type PollDetailResponse = PollDetail;
export declare const getPollDetailFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (pollId: number) => Promise<PollDetail>;
