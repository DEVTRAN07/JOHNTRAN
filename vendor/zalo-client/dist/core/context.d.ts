/**
 * Session context: everything a logged-in session needs to talk to Zalo.
 */
import type { Agent } from "http";
import type { CookieJar } from "tough-cookie";
import type { LogLevel } from "./logger.js";
export type UploadEventData = {
    fileUrl: string;
    fileId: string;
};
export type UploadCallback = (data: UploadEventData) => unknown;
type ShareFileSettings = {
    big_file_domain_list: string[];
    max_size_share_file_v2: number;
    max_size_share_file_v3: number;
    file_upload_show_icon_1GB: boolean;
    restricted_ext: string;
    next_file_time: number;
    max_file: number;
    max_size_photo: number;
    max_size_share_file: number;
    max_size_resize_photo: number;
    max_size_gif: number;
    max_size_original_photo: number;
    chunk_size_file: number;
    restricted_ext_file: string[];
};
type SocketSettings = {
    rotate_error_codes: number[];
    retries: {
        [key: string]: {
            max?: number;
            times: number[] | number;
        };
    };
    debug: {
        enable: boolean;
    };
    ping_interval: number;
    reset_endpoint: number;
    queue_ctrl_actionid_map: {
        "611_0": string;
        "610_1": string;
        "610_0": string;
        "603_0": string;
        "611_1": string;
    };
    close_and_retry_codes: number[];
    max_msg_size: number;
    enable_ctrl_socket: boolean;
    reconnect_after_fallback: boolean;
    enable_chat_socket: boolean;
    submit_wss_log: boolean;
    disable_lp: boolean;
    offline_monitor: {
        enable: boolean;
    };
};
type LoginInfo = {
    [key: string]: any;
    haspcclient: number;
    public_ip: string;
    language: string;
    send2me_id: string;
    zpw_service_map_v3: {
        other_contact: string[];
        chat_e2e: string[];
        workspace: string[];
        catalog: string[];
        boards: string[];
        downloadStickerUrl: string[];
        sp_contact: string[];
        zcloud_up_file: string[];
        media_store_send2me: string[];
        push_act: string[];
        aext: string[];
        zfamily: string[];
        group_poll: string[];
        group_cloud_message: string[];
        media_store: string[];
        file: string[];
        auto_reply: string[];
        sync_action: string[];
        friendLan: string[];
        friend: string[];
        alias: string[];
        zimsg: string[];
        group_board: string[];
        conversation: string[];
        group: string[];
        fallback_LP: string[];
        friend_board: string[];
        up_file: string[];
        zavi: string[];
        reaction: string[];
        voice_call: string[];
        profile: string[];
        sticker: string[];
        label: string[];
        consent: string[];
        zcloud: string[];
        chat: string[];
        todoUrl: string[];
        recent_search: string[];
        group_e2e: string[];
        quick_message: string[];
    };
};
type ExtraVer = {
    phonebook: number;
    conv_label: string;
    friend: string;
    ver_sticker_giphy_suggest: number;
    ver_giphy_cate: number;
    alias: string;
    ver_sticker_cate_list: number;
    block_friend: string;
};
export type ZPWServiceMap = LoginInfo["zpw_service_map_v3"];
export type AppContextBase = {
    uid: string;
    imei: string;
    cookie: CookieJar;
    userAgent: string;
    language: string;
    secretKey: string | null;
    zpwServiceMap: ZPWServiceMap;
    settings: {
        [key: string]: any;
        features: {
            [key: string]: any;
            sharefile: ShareFileSettings;
            socket: SocketSettings;
        };
        keepalive: {
            alway_keepalive: number;
            keepalive_duration: number;
            time_deactive: number;
        };
    };
    loginInfo: LoginInfo;
    extraVer: ExtraVer;
};
export type ImageMetadataGetterResponse = {
    width: number;
    height: number;
    size: number;
} | null;
export type ImageMetadataGetter = (filePath: string) => Promise<ImageMetadataGetterResponse>;
/**
 * Retry / timeout policy for outgoing HTTP requests.
 *
 * By default only idempotent methods (`GET`, `HEAD`) are retried, so a flaky
 * network can never duplicate a sent message.
 */
export type RetryOptions = {
    /** Maximum retry attempts after the initial request. Default `3`. */
    limit?: number;
    /** Base delay (ms) of the exponential backoff. Default `250`. */
    delayMs?: number;
    /** Upper bound (ms) for a single backoff delay. Default `5000`. */
    maxDelayMs?: number;
    /** HTTP methods eligible for retry. Default `["GET", "HEAD"]`. */
    methods?: string[];
    /** Overall request timeout (ms). Default `60000`. Use `0` to disable. */
    timeoutMs?: number;
};
export declare const DEFAULT_RETRY_OPTIONS: Required<RetryOptions>;
export type Options = {
    /** Receive events triggered by the current account (self listen). */
    selfListen?: boolean;
    /**
     * Logging toggle. Pass `true`/`false` or a level:
     * `"silent" | "error" | "warn" | "info" | "verbose"`.
     */
    logging?: boolean | LogLevel;
    apiType?: number;
    apiVersion?: number;
    agent?: Agent;
    /** Retry and timeout policy for HTTP requests. */
    retry?: RetryOptions;
    /**
     * Optional fetch implementation for non-standard environments.
     * If using a proxy, `node-fetch` is highly recommended.
     */
    polyfill?: typeof fetch;
    imageMetadataGetter?: ImageMetadataGetter;
};
declare class CallbacksMap extends Map<string, UploadCallback> {
    /**
     * @param ttl Time to live in milliseconds. Default is 5 minutes.
     */
    set(key: string, value: UploadCallback, ttl?: number): this;
}
export type AppContextExtended = {
    uploadCallbacks: CallbacksMap;
    options: Options;
    readonly API_TYPE: number;
    readonly API_VERSION: number;
};
export type ContextBase = Partial<AppContextBase> & AppContextExtended;
export declare const createContext: (apiType?: number, apiVersion?: number) => ContextBase;
export type ContextSession = AppContextBase & AppContextExtended & {
    secretKey: string;
};
export declare function isContextSession(ctx: ContextBase): ctx is ContextSession;
export declare const MAX_MESSAGES_PER_SEND = 50;
export {};
