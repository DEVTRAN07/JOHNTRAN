import toughCookie from "tough-cookie";
import { loginQR, LoginQRCallbackEventType } from "./api/loginQR.js";
import { getServerInfo, login } from "./api/login.js";
import { createContext, isContextSession } from "./core/context.js";
import { generateZaloUUID } from "./core/crypto.js";
import { ZaloApiError } from "./core/errors.js";
import { logger } from "./core/logger.js";
import { ZaloApi } from "./api/index.js";
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0";
/**
 * Entry point of the library: authenticates and returns a ready-to-use API
 * instance.
 *
 * @example
 * const client = new ZaloClient({ logging: "info" });
 * const api = await client.login({ imei, cookie, userAgent });
 * await api.sendMessage("Hello", "123456789");
 */
export class ZaloClient {
    constructor(options = {}) {
        this.options = options;
        this.enableEncryptParam = true;
    }
    parseCookies(cookie) {
        const cookieArr = Array.isArray(cookie)
            ? [...cookie]
            : cookie.cookies;
        // Zalo sometimes returns leading-dot domains; tough-cookie wants them stripped.
        for (const [index, entry] of cookieArr.entries()) {
            const domain = entry.domain;
            if (typeof domain === "string" && domain.startsWith(".")) {
                cookieArr[index].domain = domain.slice(1);
            }
        }
        const jar = new toughCookie.CookieJar();
        for (const entry of cookieArr) {
            try {
                const cookieObj = toughCookie.Cookie.fromJSON(Object.assign(Object.assign({}, entry), { key: entry.key || entry.name }));
                if (cookieObj) {
                    const domain = cookieObj.domain || "chat.zalo.me";
                    const url = `https://${domain.startsWith(".") ? domain.slice(1) : domain}`;
                    jar.setCookieSync(cookieObj, url);
                }
            }
            catch (error) {
                logger({ options: this.options }).error("Failed to set cookie:", error);
            }
        }
        return jar;
    }
    validateParams(credentials) {
        if (!credentials.imei || !credentials.cookie || !credentials.userAgent) {
            throw new ZaloApiError("Missing required params");
        }
    }
    /**
     * Logs in with an existing cookie + imei + userAgent triple.
     */
    async login(credentials) {
        const ctx = createContext(this.options.apiType, this.options.apiVersion);
        Object.assign(ctx.options, this.options);
        return this.loginCookie(ctx, credentials);
    }
    async loginCookie(ctx, credentials) {
        this.validateParams(credentials);
        ctx.imei = credentials.imei;
        ctx.cookie = this.parseCookies(credentials.cookie);
        ctx.userAgent = credentials.userAgent;
        ctx.language = credentials.language || "vi";
        const loginData = await login(ctx, this.enableEncryptParam);
        const serverInfo = await getServerInfo(ctx, this.enableEncryptParam);
        const loginInfo = loginData === null || loginData === void 0 ? void 0 : loginData.data;
        if (!loginData || !loginInfo || !serverInfo)
            throw new ZaloApiError("Đăng nhập thất bại");
        ctx.secretKey = loginInfo.zpw_enk;
        ctx.uid = loginInfo.uid;
        // Zalo currently responds with setttings instead of settings
        // they might fix this in the future, so we should have a fallback just in case
        ctx.settings = serverInfo.setttings || serverInfo.settings;
        ctx.extraVer = serverInfo.extra_ver;
        ctx.loginInfo = loginInfo;
        if (!isContextSession(ctx))
            throw new ZaloApiError("Khởi tạo ngữ cảnh thất bại.");
        logger(ctx).info("Logged in as", loginInfo.uid);
        return new ZaloApi(ctx, loginInfo.zpw_service_map_v3, loginInfo.zpw_ws);
    }
    /**
     * Logs in by scanning a QR code.
     *
     * @param options Login options (user agent, language, QR image path)
     * @param callback Optional progress callback; also receives the resulting
     * credentials on the `GotLoginInfo` event so they can be persisted.
     */
    async loginQR(options, callback) {
        const resolvedOptions = {
            userAgent: (options === null || options === void 0 ? void 0 : options.userAgent) || DEFAULT_USER_AGENT,
            language: (options === null || options === void 0 ? void 0 : options.language) || "vi",
            qrPath: options === null || options === void 0 ? void 0 : options.qrPath,
        };
        const ctx = createContext(this.options.apiType, this.options.apiVersion);
        Object.assign(ctx.options, this.options);
        const loginQRResult = await loginQR(ctx, resolvedOptions, callback);
        if (!loginQRResult)
            throw new ZaloApiError("Unable to login with QRCode");
        const imei = generateZaloUUID(resolvedOptions.userAgent);
        if (callback) {
            // Thanks to @YanCastle for this great suggestion!
            callback({
                type: LoginQRCallbackEventType.GotLoginInfo,
                data: {
                    cookie: loginQRResult.cookies,
                    imei,
                    userAgent: resolvedOptions.userAgent,
                },
                actions: null,
            });
        }
        return this.loginCookie(ctx, {
            cookie: loginQRResult.cookies,
            imei,
            userAgent: resolvedOptions.userAgent,
            language: resolvedOptions.language,
        });
    }
}
/**
 * @deprecated Use {@link ZaloClient} instead. Kept as an alias for backwards compatibility.
 */
export { ZaloClient as Zalo };
