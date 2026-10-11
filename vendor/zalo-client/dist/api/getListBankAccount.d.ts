import type { BankAccount } from "../models/index.js";
export type GetListBankAccountResponse = {
    hasMore: boolean;
    total: number;
    myBanks: BankAccount[];
};
export declare const getListBankAccountFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (page?: number, limit?: number) => Promise<GetListBankAccountResponse>;
