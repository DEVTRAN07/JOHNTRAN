import type { UserSetting } from "../models/index.js";
export type GetSettingsResponse = UserSetting;
export declare const getSettingsFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<UserSetting>;
