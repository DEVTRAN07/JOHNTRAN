/**
 * Zalo error hierarchy.
 *
 * All errors thrown by this library inherit from {@link ZaloError}, so a single
 * `catch` clause can distinguish library failures from unexpected runtime bugs.
 */
export class ZaloError extends Error {
    constructor(message, options) {
        super(message);
        this.name = "ZaloError";
        if (options && "cause" in options)
            this.cause = options.cause;
    }
}
export class ZaloApiError extends ZaloError {
    constructor(message, code, options) {
        super(message, options);
        this.name = "ZaloApiError";
        this.code = code !== null && code !== void 0 ? code : null;
    }
}
export class ZaloApiMissingImageMetadataGetter extends ZaloApiError {
    constructor() {
        super("Missing `imageMetadataGetter`. Please provide it in the client options.");
        this.name = "ZaloApiMissingImageMetadataGetter";
    }
}
export class ZaloApiLoginQRAborted extends ZaloApiError {
    constructor(message = "Operation aborted") {
        super(message);
        this.name = "ZaloApiLoginQRAborted";
    }
}
export class ZaloApiLoginQRDeclined extends ZaloApiError {
    constructor(message = "Login QR request declined") {
        super(message);
        this.name = "ZaloApiLoginQRDeclined";
    }
}
