/**
 * Zalo error hierarchy.
 *
 * All errors thrown by this library inherit from {@link ZaloError}, so a single
 * `catch` clause can distinguish library failures from unexpected runtime bugs.
 */
export interface ZaloErrorOptions {
    cause?: unknown;
}
export declare class ZaloError extends Error {
    constructor(message: string, options?: ZaloErrorOptions);
}
export declare class ZaloApiError extends ZaloError {
    readonly code: number | null;
    constructor(message: string, code?: number | null, options?: ZaloErrorOptions);
}
export declare class ZaloApiMissingImageMetadataGetter extends ZaloApiError {
    constructor();
}
export declare class ZaloApiLoginQRAborted extends ZaloApiError {
    constructor(message?: string);
}
export declare class ZaloApiLoginQRDeclined extends ZaloApiError {
    constructor(message?: string);
}
