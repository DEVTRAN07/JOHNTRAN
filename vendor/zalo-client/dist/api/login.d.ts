import type { ContextBase } from "../core/context.js";
export declare function login(ctx: ContextBase, encryptParams: boolean): Promise<Record<string, unknown> | null>;
export declare function getServerInfo(ctx: ContextBase, encryptParams: boolean): Promise<any>;
