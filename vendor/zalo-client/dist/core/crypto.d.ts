/**
 * Cryptography helpers backed by Node's built-in `node:crypto`.
 *
 * These utilities implement the signing, parameter-encryption and response
 * decryption schemes used by the Zalo platform. AES is used in CBC mode with a
 * zero IV and PKCS7 padding, matching the reference implementation byte for
 * byte.
 */
/**
 * MD5 of a string, lowercase hex.
 */
export declare function md5(data: string | Buffer): string;
/**
 * Get the signed key (`signkey`) required by Zalo API requests.
 *
 * @param type API type, e.g. `"getserverinfo"`
 * @param params Request params; keys are sorted before hashing
 * @returns MD5 hash of `"zsecure" + type + <param values in sorted key order>`
 */
export declare function getSignKey(type: string, params: Record<string, unknown>): string;
/**
 * Encrypts a UTF-8 payload with an AES-CBC key (zero IV, PKCS7 padding).
 *
 * @param secretKey Base64 encoded key
 * @param data Payload to encrypt
 * @returns Base64 ciphertext, or `null` when encryption fails
 */
export declare function encodeAES(secretKey: string, data: string | Buffer): string | null;
/**
 * Decrypts a Base64 AES-CBC ciphertext (zero IV, PKCS7 padding).
 *
 * @param secretKey Base64 encoded key
 * @param data Base64 ciphertext
 * @returns Decrypted UTF-8 string, or `null` when decryption fails
 */
export declare function decodeAES(secretKey: string, data: string): string | null;
/**
 * Decrypts and parses an encrypted login response.
 *
 * @param key Encryption key (UTF-8) returned by the login param encryptor
 * @param data Encrypted Base64 payload
 */
export declare function decryptResp(key: string, data: string): Record<string, unknown> | null | string;
/**
 * Encrypts login params the way the Zalo web client does, deriving a device
 * identifier (`zcid`) and an encryption key from it.
 */
export declare class ParamsEncryptor {
    private zcid;
    private enc_ver;
    private zcid_ext;
    private encryptKey;
    constructor({ type, imei, firstLaunchTime }: {
        type: number;
        imei: string;
        firstLaunchTime: number;
    });
    getEncryptKey(): string;
    private createZcid;
    private createEncryptKey;
    getParams(): {
        zcid: string;
        zcid_ext: string;
        enc_ver: string;
    } | null;
    private static processStr;
    private static randomString;
    /**
     * Encrypts a payload with a raw (UTF-8) AES key.
     *
     * @param key UTF-8 key material
     * @param message Payload to encrypt
     * @param encoding Output encoding
     * @param uppercase Uppercase the output when `true`
     */
    static encodeAES(key: string, message: string, encoding?: "hex" | "base64", uppercase?: boolean): string | null;
}
/**
 * Generates a device identifier (`imei`) bound to the given user agent.
 */
export declare function generateZaloUUID(userAgent: string): string;
/**
 * Hashes a 4-digit PIN into the 32-character hex digest used by Zalo.
 */
export declare function encryptPin(pin: string): string;
/**
 * Verifies a PIN against its stored hash (the hash is one-way).
 */
export declare function validatePin(encryptedPin: string, pin: string): boolean;
