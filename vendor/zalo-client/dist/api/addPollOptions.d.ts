import type { PollOptions } from "../models/index.js";
export type AddPollOptionsOption = {
    voted: boolean;
    content: string;
};
export type AddPollOptionsPayload = {
    pollId: number;
    options: AddPollOptionsOption[];
    votedOptionIds: number[];
};
export type AddPollOptionsResponse = {
    options: PollOptions[];
};
export declare const addPollOptionsFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: AddPollOptionsPayload) => Promise<AddPollOptionsResponse>;
