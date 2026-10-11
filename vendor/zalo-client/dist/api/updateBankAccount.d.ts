import type { BankAccount, BinBankCard } from "../models/index.js";
export type UpdateBankAccountPayload = {
    accountId: number;
    binBank: BinBankCard;
    numAccBank: string;
    nameAccBank: string;
};
export type UpdateBankAccountResponse = BankAccount;
export declare const updateBankAccountFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: UpdateBankAccountPayload) => Promise<BankAccount>;
