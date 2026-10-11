import { type ContextSession } from "../core/context.js";
import { type FactoryUtils } from "../core/factory.js";
export type CustomAPIProps<T, K> = {
    ctx: ContextSession;
    utils: FactoryUtils<T>;
    props: K;
};
export type CustomAPICallback<T, K> = (props: CustomAPIProps<T, K>) => T | Promise<T>;
export declare const customFactory: (ctx: import("../core/context.js").ContextBase, api: import("./index.js").ZaloApi) => <T, K = any>(name: string, callback: CustomAPICallback<T, K>) => void;
