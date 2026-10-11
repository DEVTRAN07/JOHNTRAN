import type { LabelData } from "../models/index.js";
export type GetLabelsResponse = {
    labelData: LabelData[];
    version: number;
    lastUpdateTime: number;
};
export declare const getLabelsFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetLabelsResponse>;
