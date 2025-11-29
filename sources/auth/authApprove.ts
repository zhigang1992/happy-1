
import axios from 'axios';
import { encodeBase64 } from "../encryption/base64";
import { getServerUrl } from "@/sync/serverConfig";

interface AuthRequestStatus {
    status: 'not_found' | 'pending' | 'authorized';
    supportsV2: boolean;
}

/**
 * Approve a terminal authentication request
 *
 * @param token - The user's auth token
 * @param publicKey - The terminal's ephemeral public key
 * @param answerV1 - The V1 encrypted response
 * @param answerV2 - The V2 encrypted response
 * @param serverUrlOverride - Optional server URL override for self-hosted setups
 */
export async function authApprove(token: string, publicKey: Uint8Array, answerV1: Uint8Array, answerV2: Uint8Array, serverUrlOverride?: string) {
    // Use override URL if provided (for self-hosted setups), otherwise use configured server
    const API_ENDPOINT = serverUrlOverride || getServerUrl();
    const publicKeyBase64 = encodeBase64(publicKey);

    console.log('[AuthApprove] Starting auth approval');
    console.log('[AuthApprove] API endpoint:', API_ENDPOINT);
    console.log('[AuthApprove] Public key (truncated):', publicKeyBase64.substring(0, 20) + '...');

    // First, check the auth request status
    console.log('[AuthApprove] Checking auth request status...');
    const statusResponse = await axios.get<AuthRequestStatus>(
        `${API_ENDPOINT}/v1/auth/request/status`,
        {
            params: {
                publicKey: publicKeyBase64
            }
        }
    );

    const { status, supportsV2 } = statusResponse.data;
    console.log('[AuthApprove] Status response:', { status, supportsV2 });

    // Handle different status cases
    if (status === 'not_found') {
        // Auth request doesn't exist - this could mean the CLI hasn't created it yet
        console.log('[AuthApprove] Auth request not found - CLI may not have created the request yet');
        throw new Error('Auth request not found - please ensure the CLI is waiting for authorization');
    }

    if (status === 'authorized') {
        // Already authorized, no need to approve again
        console.log('[AuthApprove] Auth request already authorized');
        return;
    }

    // Handle pending status
    if (status === 'pending') {
        console.log('[AuthApprove] Sending auth response...');
        const response = await axios.post(`${API_ENDPOINT}/v1/auth/response`, {
            publicKey: publicKeyBase64,
            response: supportsV2 ? encodeBase64(answerV2) : encodeBase64(answerV1)
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
            }
        });
        console.log('[AuthApprove] Auth response sent successfully:', response.status);
    }
}