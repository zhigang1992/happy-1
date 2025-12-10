import * as React from 'react';
import { View, ActivityIndicator, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native-unistyles';
import { sync } from '@/sync/sync';
import { MessageImageRef } from '@/sync/reducer/reducer';

interface MessageImageProps {
    image: MessageImageRef;
    sessionId: string;
}

/**
 * Displays an encrypted image from a message.
 * Downloads and decrypts the blob on mount, caches the result.
 */
export function MessageImage({ image, sessionId }: MessageImageProps) {
    const [imageUri, setImageUri] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;

        async function loadImage() {
            setLoading(true);
            setError(false);

            const result = await sync.downloadAndDecryptBlob(sessionId, image.blobId);
            if (cancelled) return;

            if (result) {
                // Convert Uint8Array to base64 data URI
                const base64 = uint8ArrayToBase64(result.data);
                const dataUri = `data:${result.mimeType};base64,${base64}`;
                setImageUri(dataUri);
            } else {
                setError(true);
            }
            setLoading(false);
        }

        loadImage();

        return () => {
            cancelled = true;
        };
    }, [sessionId, image.blobId]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" />
            </View>
        );
    }

    if (error || !imageUri) {
        return (
            <View style={styles.errorContainer}>
                <View style={styles.errorPlaceholder} />
            </View>
        );
    }

    return (
        <Pressable style={styles.container}>
            <Image
                source={{ uri: imageUri }}
                style={{ width: 200, height: 200 }}
                contentFit="cover"
            />
        </Pressable>
    );
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

const styles = StyleSheet.create((theme) => ({
    container: {
        borderRadius: 8,
        overflow: 'hidden',
        marginTop: 8,
    },
    loadingContainer: {
        width: 200,
        height: 150,
        borderRadius: 8,
        backgroundColor: theme.colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    errorContainer: {
        width: 200,
        height: 150,
        borderRadius: 8,
        backgroundColor: theme.colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    errorPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.colors.textSecondary,
        opacity: 0.3,
    },
}));
