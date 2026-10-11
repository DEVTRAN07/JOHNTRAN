export type GetReminderResponsesResponse = {
    rejectMember: string[];
    acceptMember: string[];
};
export declare const getReminderResponsesFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (reminderId: string) => Promise<GetReminderResponsesResponse>;
