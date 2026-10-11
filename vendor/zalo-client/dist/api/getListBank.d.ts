import type { BankInfo } from "../models/index.js";
export type GetListBankResponse = {
    banks: BankInfo[];
};
export declare const getListBankFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetListBankResponse>;
