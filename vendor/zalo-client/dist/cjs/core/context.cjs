'use strict';

/**
 * Session context: everything a logged-in session needs to talk to Zalo.
 */
const DEFAULT_RETRY_OPTIONS = {
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
const createContext = (apiType = 30, apiVersion = 685) => ({
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
function isContextSession(ctx) {
    return !!ctx.secretKey;
}
const MAX_MESSAGES_PER_SEND = 50;

exports.DEFAULT_RETRY_OPTIONS = DEFAULT_RETRY_OPTIONS;
exports.MAX_MESSAGES_PER_SEND = MAX_MESSAGES_PER_SEND;
exports.createContext = createContext;
exports.isContextSession = isContextSession;
