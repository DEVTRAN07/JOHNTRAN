import type { NoteDetail } from "../models/index.js";
export type CreateNoteOptions = {
    title: string;
    pinAct?: boolean;
};
export type CreateNoteResponse = NoteDetail;
export declare const createNoteFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => (options: CreateNoteOptions, groupId: string) => Promise<NoteDetail>;
