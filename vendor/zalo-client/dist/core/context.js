/**
 * Session context: everything a logged-in session needs to talk to Zalo.
 */
export const DEFAULT_RETRY_OPTIONS = {
    limit: 3,
    delayMs: 250,
    maxDelayMs: 5000,
    methods: ["GET", "HEAD"],
    timeoutMs: 60000,
};
const _5_MINUTES = 5 * 60 * 1000;
class CallbacksMap extends Map {
    /**
     * @param ttl Time to live in milliseconds. Default is 5 minutes.
     */
    set(key, value, ttl = _5_MINUTES) {
        const timer = setTimeout(() => {
            this.delete(key);
        }, ttl);
        // Never keep the process alive just for a pending upload callback.
        if (typeof timer === "object" && typeof timer.unref === "function")
            timer.unref();
        return super.set(key, value);
    }
}
export const createContext = (apiType = 30, apiVersion = 685) => ({
    API_TYPE: apiType,
    API_VERSION: apiVersion,
    uploadCallbacks: new CallbacksMap(),
    options: {
        selfListen: false,
        logging: true,
        polyfill: globalThis.fetch.bind(globalThis),
    },
    secretKey: null,
});
export function isContextSession(ctx) {
    return !!ctx.secretKey;
}
export const MAX_MESSAGES_PER_SEND = 50;
