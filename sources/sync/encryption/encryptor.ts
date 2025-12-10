import { decryptBox, decryptSecretBox, encryptBox, encryptSecretBox } from "@/encryption/libsodium";
import { encodeBase64, decodeBase64 } from "@/encryption/base64";
import sodium from '@/encryption/libsodium.lib';
import { decodeUTF8, encodeUTF8 } from "@/encryption/text";
import { decryptAESGCMString, encryptAESGCMString } from "@/encryption/aes";

//
// IMPORTANT: Right now there is a bug in the AES implementation and it works only with a normal strings converted to Uint8Array. 
// Any abnormal string might break encoding and decoding utf8.
//

export interface Encryptor {
    encrypt(data: any[]): Promise<Uint8Array[]>;
    encryptBlob(data: Uint8Array): Promise<Uint8Array>;
}

export interface Decryptor {
    decrypt(data: Uint8Array[]): Promise<(any | null)[]>;
    decryptBlob(data: Uint8Array): Promise<Uint8Array | null>;
}

export class SecretBoxEncryption implements Encryptor, Decryptor {
    private readonly secretKey: Uint8Array;

    constructor(secretKey: Uint8Array) {
        this.secretKey = secretKey;
    }

    async decrypt(data: Uint8Array[]): Promise<(any | null)[]> {
        // Process as batch, not Promise.all - more efficient
        const results: (any | null)[] = [];
        for (const item of data) {
            results.push(decryptSecretBox(item, this.secretKey));
        }
        return results;
    }

    async encrypt(data: any[]): Promise<Uint8Array[]> {
        // Process as batch, not Promise.all - more efficient
        const results: Uint8Array[] = [];
        for (const item of data) {
            results.push(encryptSecretBox(item, this.secretKey));
        }
        return results;
    }

    async encryptBlob(data: Uint8Array): Promise<Uint8Array> {
        // For SecretBox, we use the same encryption but skip JSON serialization
        const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
        const ciphertext = sodium.crypto_secretbox_easy(data, nonce, this.secretKey);
        // Bundle: version(1) + nonce + ciphertext
        const result = new Uint8Array(1 + nonce.length + ciphertext.length);
        result[0] = 0; // version 0
        result.set(nonce, 1);
        result.set(ciphertext, 1 + nonce.length);
        return result;
    }

    async decryptBlob(data: Uint8Array): Promise<Uint8Array | null> {
        if (data.length < 1 + sodium.crypto_secretbox_NONCEBYTES) {
            return null;
        }
        if (data[0] !== 0) {
            return null;
        }
        const nonce = data.slice(1, 1 + sodium.crypto_secretbox_NONCEBYTES);
        const ciphertext = data.slice(1 + sodium.crypto_secretbox_NONCEBYTES);
        try {
            return sodium.crypto_secretbox_open_easy(ciphertext, nonce, this.secretKey);
        } catch {
            return null;
        }
    }
}

export class BoxEncryption implements Encryptor, Decryptor {
    private readonly privateKey: Uint8Array;
    private readonly publicKey: Uint8Array;

    constructor(seed: Uint8Array) {
        // Use the seed to generate a proper keypair
        const keypair = sodium.crypto_box_seed_keypair(seed);
        this.privateKey = keypair.privateKey;
        this.publicKey = keypair.publicKey;
    }

    async encrypt(data: any[]): Promise<Uint8Array[]> {
        // Process as batch, not Promise.all - more efficient
        const results: Uint8Array[] = [];
        for (const item of data) {
            results.push(encryptBox(encodeUTF8(JSON.stringify(item)), this.publicKey));
        }
        return results;
    }

    async decrypt(data: Uint8Array[]): Promise<(any | null)[]> {
        // Process as batch, not Promise.all - more efficient
        const results: (any | null)[] = [];
        for (const item of data) {
            let decrypted = decryptBox(item, this.privateKey);
            if (!decrypted) {
                results.push(null);
                continue;
            }
            results.push(JSON.parse(decodeUTF8(decrypted)));
        }
        return results;
    }

    async encryptBlob(data: Uint8Array): Promise<Uint8Array> {
        // For Box encryption, we use sealed box for binary data
        const encrypted = encryptBox(data, this.publicKey);
        // Bundle: version(1) + encrypted
        const result = new Uint8Array(1 + encrypted.length);
        result[0] = 0; // version 0
        result.set(encrypted, 1);
        return result;
    }

    async decryptBlob(data: Uint8Array): Promise<Uint8Array | null> {
        if (data.length < 1) {
            return null;
        }
        if (data[0] !== 0) {
            return null;
        }
        return decryptBox(data.slice(1), this.privateKey);
    }
}

export class AES256Encryption implements Encryptor, Decryptor {
    private readonly secretKey: Uint8Array;
    private readonly secretKeyB64: string;
    private cryptoKey: CryptoKey | null = null;

    constructor(secretKey: Uint8Array) {
        this.secretKey = secretKey;
        this.secretKeyB64 = encodeBase64(secretKey);
    }

    private async getCryptoKey(): Promise<CryptoKey> {
        if (this.cryptoKey) {
            return this.cryptoKey;
        }
        // Import the key for use with Web Crypto API
        // Create a new Uint8Array copy to get a proper ArrayBuffer
        const keyBytes = new Uint8Array(this.secretKey);
        this.cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBytes,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt']
        );
        return this.cryptoKey;
    }

    async encrypt(data: any[]): Promise<Uint8Array[]> {
        // Process as batch, not Promise.all - more efficient
        const results: Uint8Array[] = [];
        for (const item of data) {
            // Serialize to JSON string first
            const encrypted = decodeBase64(await encryptAESGCMString(JSON.stringify(item), this.secretKeyB64));
            let output = new Uint8Array(encrypted.length + 1);
            output[0] = 0;
            output.set(encrypted, 1);
            results.push(output);
        }
        return results;
    }

    async decrypt(data: Uint8Array[]): Promise<(any | null)[]> {
        // Process as batch, not Promise.all - more efficient
        const results: (any | null)[] = [];
        for (const item of data) {
            try {
                if (item[0] !== 0) {
                    results.push(null);
                    continue;
                }
                const decryptedString = await decryptAESGCMString(encodeBase64(item.slice(1)), this.secretKeyB64);
                if (!decryptedString) {
                    results.push(null);
                } else {
                    // Parse JSON string back to object
                    results.push(JSON.parse(decryptedString));
                }
            } catch (error) {
                results.push(null);
            }
        }
        return results;
    }

    async encryptBlob(data: Uint8Array): Promise<Uint8Array> {
        // Use Web Crypto API for binary blob encryption (AES-256-GCM)
        const key = await this.getCryptoKey();
        const nonce = crypto.getRandomValues(new Uint8Array(12)); // 96-bit nonce for GCM

        // Create a new Uint8Array copy to get a proper ArrayBuffer
        const dataBytes = new Uint8Array(data);

        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: nonce },
            key,
            dataBytes
        );

        // Bundle: version(1) + nonce(12) + ciphertext (includes 16-byte auth tag)
        const result = new Uint8Array(1 + 12 + ciphertext.byteLength);
        result[0] = 0; // version 0
        result.set(nonce, 1);
        result.set(new Uint8Array(ciphertext), 13);
        return result;
    }

    async decryptBlob(data: Uint8Array): Promise<Uint8Array | null> {
        if (data.length < 1 + 12 + 16) { // version + nonce + auth tag minimum
            return null;
        }
        if (data[0] !== 0) {
            return null;
        }

        try {
            const key = await this.getCryptoKey();
            const nonce = data.slice(1, 13);
            const ciphertext = data.slice(13);

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: nonce },
                key,
                ciphertext
            );

            return new Uint8Array(decrypted);
        } catch {
            return null;
        }
    }
}