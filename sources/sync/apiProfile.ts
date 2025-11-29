import { AuthCredentials } from '@/auth/tokenStorage';
import { backoff } from '@/utils/time';
import { getServerUrl } from './serverConfig';

export interface UpdateProfileParams {
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
}

export interface UpdateProfileResult {
    username: string | null;
    firstName: string | null;
    lastName: string | null;
}

export type UpdateProfileError = 'username-taken' | 'validation-error' | 'unknown';

/**
 * Update the user's profile (username, firstName, lastName).
 * Returns the updated profile on success, or throws with error type.
 */
export async function updateProfile(
    credentials: AuthCredentials,
    params: UpdateProfileParams
): Promise<UpdateProfileResult> {
    const API_ENDPOINT = getServerUrl();

    return await backoff(async () => {
        const response = await fetch(`${API_ENDPOINT}/v1/account/profile`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${credentials.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(params)
        });

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 409 && data.error === 'username-taken') {
                const error = new Error('Username is already taken') as Error & { code: UpdateProfileError };
                error.code = 'username-taken';
                throw error;
            }
            const error = new Error(data.error || 'Failed to update profile') as Error & { code: UpdateProfileError };
            error.code = 'validation-error';
            throw error;
        }

        if (!data.success) {
            const error = new Error('Failed to update profile') as Error & { code: UpdateProfileError };
            error.code = 'unknown';
            throw error;
        }

        return data.profile as UpdateProfileResult;
    });
}
