export type MuteEntriesInfo = {
    id: string;
    duration: number;
    startTime: number;
    systemTime: number;
    currentTime: number;
    muteMode: number;
};
export type GetMuteResponse = {
    chatEntries: MuteEntriesInfo[];
    groupChatEntries: MuteEntriesInfo[];
};
export declare const getMuteFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetMuteResponse>;
