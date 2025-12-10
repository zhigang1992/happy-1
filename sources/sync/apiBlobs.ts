import { getServerUrl } from './serverConfig';
import { TokenStorage } from '@/auth/tokenStorage';
import { log } from '@/log';

/**
 * Response from blob upload endpoint
 */
export interface BlobUploadResponse {
    blobId: string;
    size: number;
}

/**
 * Upload an encrypted blob to the server
 *
 * @param sessionId - The session ID to upload the blob to
 * @param encryptedData - The encrypted blob data
 * @param mimeType - The MIME type of the original file
 * @param originalSize - The size of the original (unencrypted) data
 * @returns The blob ID and size on success, or null on failure
 */
export async function uploadBlob(
    sessionId: string,
    encryptedData: Uint8Array,
    mimeType: string,
    originalSize: number
): Promise<BlobUploadResponse | null> {
    try {
        const credentials = await TokenStorage.getCredentials();
        if (!credentials) {
            log.log('[apiBlobs] No auth token available');
            return null;
        }

        const serverUrl = getServerUrl();
        const url = `${serverUrl}/v1/sessions/${sessionId}/blobs`;

        // Convert Uint8Array to Blob for fetch body (TypeScript compatibility)
        // Create a new Uint8Array copy to ensure proper ArrayBuffer type
        const dataBytes = new Uint8Array(encryptedData);
        const blob = new Blob([dataBytes], { type: 'application/octet-stream' });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${credentials.token}`,
                'Content-Type': 'application/octet-stream',
                'X-Blob-MimeType': mimeType,
                'X-Blob-Size': originalSize.toString(),
            },
            body: blob,
        });

        if (!response.ok) {
            log.log('[apiBlobs] Upload failed: ' + response.status + ' ' + response.statusText);
            return null;
        }

        const result = await response.json();
        return {
            blobId: result.blobId,
            size: result.size,
        };
    } catch (error) {
        log.log('[apiBlobs] Upload error: ' + error);
        return null;
    }
}

/**
 * Download an encrypted blob from the server
 *
 * @param sessionId - The session ID the blob belongs to
 * @param blobId - The blob ID to download
 * @returns The encrypted blob data and metadata, or null on failure
 */
export async function downloadBlob(
    sessionId: string,
    blobId: string
): Promise<{ data: Uint8Array; mimeType: string; size: number } | null> {
    try {
        const credentials = await TokenStorage.getCredentials();
        if (!credentials) {
            log.log('[apiBlobs] No auth token available');
            return null;
        }

        const serverUrl = getServerUrl();
        const url = `${serverUrl}/v1/sessions/${sessionId}/blobs/${blobId}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${credentials.token}`,
            },
        });

        if (!response.ok) {
            log.log('[apiBlobs] Download failed: ' + response.status + ' ' + response.statusText);
            return null;
        }

        const data = new Uint8Array(await response.arrayBuffer());
        const mimeType = response.headers.get('X-Blob-MimeType') || 'application/octet-stream';
        const size = parseInt(response.headers.get('X-Blob-Size') || '0', 10);

        return { data, mimeType, size };
    } catch (error) {
        log.log('[apiBlobs] Download error: ' + error);
        return null;
    }
}
