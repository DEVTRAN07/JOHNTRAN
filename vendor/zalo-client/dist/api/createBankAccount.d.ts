import type { BankAccount, BinBankCard } from "../models/index.js";
export type CreateBankAccountPayload = {
    binBank: BinBankCard;
    numAccBank: string;
    nameAccBank: string;
};
export type CreateBankAccountResponse = BankAccount;
export declare const createBankAccountFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: CreateBankAccountPayload) => Promise<BankAccount>;
