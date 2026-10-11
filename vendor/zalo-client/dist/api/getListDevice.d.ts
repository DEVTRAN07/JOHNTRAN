export type GetListDeviceResponse = {
    devices: {
        masterId: string;
        encIdentity: string;
        lastUpdateTs: number;
        encSignature: string;
        companions: unknown[];
    };
};
export declare const getListDeviceFactory: (ctx: import("../index.js").ContextBase, api: import("./index.js").ZaloApi) => () => Promise<GetListDeviceResponse>;
