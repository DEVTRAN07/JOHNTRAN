import { ThreadType } from "../models/index.js";
export type SetMuteParams = {
    /**
     * Mute duration in seconds or predefined durations
     */
    duration?: MuteDuration | number;
    action?: MuteAction;
};
export type SetMuteResponse = "";
export declare enum MuteDuration {
    ONE_HOUR = 3600,
    FOUR_HOURS = 14400,
    FOREVER = -1,
    UNTIL_8AM = "until8AM"
}
export declare enum MuteAction {
    MUTE = 1,
    UNMUTE = 3
}
export declare const setMuteFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (params: SetMuteParams | undefined, threadID: string, type?: ThreadType) => Promise<"">;
