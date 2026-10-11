import type { BankAccount } from "../models/index.js";
export type DeleteBankAccountPayload = {
    accountId: number;
    isDefault: boolean;
};
export type DeleteBankAccountResponse = {
    hasMore: boolean;
    total: number;
    myBanks: BankAccount[];
};
export declare const deleteBankAccountFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: DeleteBankAccountPayload) => Promise<DeleteBankAccountResponse>;
