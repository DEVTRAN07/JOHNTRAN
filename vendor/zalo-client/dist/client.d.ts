import toughCookie from "tough-cookie";
import { type LoginQRCallback } from "./api/loginQR.js";
import { type Options } from "./core/context.js";
import { ZaloApi } from "./api/index.js";
export type Cookie = {
    domain: string;
    expirationDate: number;
    hostOnly: boolean;
    httpOnly: boolean;
    name: string;
    path: string;
    sameSite: string;
    secure: boolean;
    session: boolean;
    storeId: string;
    value: string;
};
export type Credentials = {
    imei: string;
    cookie: Cookie[] | toughCookie.SerializedCookie[] | {
        url: string;
        cookies: Cookie[];
    };
    userAgent: string;
    language?: string;
};
export type LoginQROptions = {
    userAgent?: string;
    language?: string;
    qrPath?: string;
};
/**
 * Entry point of the library: authenticates and returns a ready-to-use API
 * instance.
 *
 * @example
 * const client = new ZaloClient({ logging: "info" });
 * const api = await client.login({ imei, cookie, userAgent });
 * await api.sendMessage("Hello", "123456789");
 */
export declare class ZaloClient {
    private options;
    private enableEncryptParam;
    constructor(options?: Partial<Options>);
    private parseCookies;
    private validateParams;
    /**
     * Logs in with an existing cookie + imei + userAgent triple.
     */
    login(credentials: Credentials): Promise<ZaloApi>;
    private loginCookie;
    /**
     * Logs in by scanning a QR code.
     *
     * @param options Login options (user agent, language, QR image path)
     * @param callback Optional progress callback; also receives the resulting
     * credentials on the `GotLoginInfo` event so they can be persisted.
     */
    loginQR(options?: LoginQROptions, callback?: LoginQRCallback): Promise<ZaloApi>;
}
/**
 * @deprecated Use {@link ZaloClient} instead. Kept as an alias for backwards compatibility.
 */
export { ZaloClient as Zalo };
