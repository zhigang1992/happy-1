import { Platform } from 'react-native';
import { randomUUID as expoRandomUUID } from 'expo-crypto';

/**
 * Cross-platform UUID v4 generator with fallback for non-secure contexts.
 *
 * expo-crypto's randomUUID uses crypto.randomUUID() which requires a secure context
 * (HTTPS) in browsers. When running on HTTP (e.g., local development), we fall back
 * to a UUID implementation using crypto.getRandomValues() which works in all contexts.
 *
 * On native platforms (iOS/Android), expo-crypto always works.
 */
export function randomUUID(): string {
    // On native platforms, expo-crypto always works
    if (Platform.OS !== 'web') {
        return expoRandomUUID();
    }

    // On web, try expo-crypto first (works in secure contexts)
    try {
        // Check if crypto.randomUUID is available
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return expoRandomUUID();
        }
    } catch {
        // Fall through to fallback
    }

    // Fallback for non-secure contexts (HTTP)
    // Uses crypto.getRandomValues() which works in all contexts
    return generateUUIDv4Fallback();
}

/**
 * Generate a UUID v4 using crypto.getRandomValues() which works in non-secure contexts.
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * Where x is random hex, 4 is the version, and y is 8, 9, a, or b.
 */
function generateUUIDv4Fallback(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version (4) in byte 6
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant (10xx) in byte 8
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    // Convert to hex string
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

    // Format as UUID
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
