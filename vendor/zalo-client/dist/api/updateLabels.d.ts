import type { LabelData } from "../models/index.js";
export type UpdateLabelsPayload = {
    labelData: LabelData[];
    version: number;
};
export type UpdateLabelsResponse = {
    labelData: LabelData[];
    version: number;
    lastUpdateTime: number;
};
export declare const updateLabelsFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: UpdateLabelsPayload) => Promise<{
    labelData: any;
    version: number;
    lastUpdateTime: number;
}>;
