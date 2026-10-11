import type { PollOptions } from "../models/index.js";
export type VotePollResponse = {
    options: PollOptions[];
};
export declare const votePollFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (pollId: number, optionId: number | number[]) => Promise<VotePollResponse>;
