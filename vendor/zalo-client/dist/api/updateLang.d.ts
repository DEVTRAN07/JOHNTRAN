export declare enum UpdateLangAvailableLanguages {
    VI = "VI",
    EN = "EN"
}
export type UpdateLangResponse = "";
export declare const updateLangFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (language?: UpdateLangAvailableLanguages) => Promise<"">;
