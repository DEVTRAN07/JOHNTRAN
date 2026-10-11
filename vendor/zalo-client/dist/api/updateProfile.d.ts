import type { BusinessCategory, Gender } from "../models/index.js";
export type UpdateProfilePayload = {
    profile: {
        name: string;
        /**
         * Date of birth in the format YYYY-MM-DD
         */
        dob: `${string}-${string}-${string}`;
        gender: Gender;
    };
    biz?: Partial<{
        cate: BusinessCategory;
        description: string;
        address: string;
        website: string;
        email: string;
    }>;
};
export type UpdateProfileResponse = "";
export declare const updateProfileFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (payload: UpdateProfilePayload) => Promise<"">;
