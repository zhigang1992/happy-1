import * as React from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface ImageThumbnailProps {
    /** Image URI (data URI or URL) */
    uri: string;
    /** Called when remove button is pressed */
    onRemove: () => void;
    /** Size of the thumbnail in pixels */
    size?: number;
    /** Whether the image is being uploaded */
    isUploading?: boolean;
}

/**
 * A square thumbnail with a remove button in the top-right corner.
 * Used to preview attached images before sending.
 */
export const ImageThumbnail = React.memo(function ImageThumbnail({
    uri,
    onRemove,
    size = 64,
    isUploading = false,
}: ImageThumbnailProps) {
    const { theme } = useUnistyles();

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            <Image
                source={{ uri }}
                style={{ width: size, height: size, borderRadius: 8 }}
                contentFit="cover"
            />

            {/* Uploading overlay */}
            {isUploading && (
                <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                </View>
            )}

            {/* Remove button */}
            {!isUploading && (
                <Pressable
                    onPress={onRemove}
                    style={({ pressed }) => [
                        styles.removeButton,
                        pressed && styles.removeButtonPressed,
                    ]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="close" size={12} color="#fff" />
                </Pressable>
            )}
        </View>
    );
});

const styles = StyleSheet.create((theme) => ({
    container: {
        position: 'relative',
        borderRadius: 8,
        overflow: 'visible',
        backgroundColor: theme.colors.surface,
    },
    uploadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeButton: {
        position: 'absolute',
        top: -6,
        right: -6,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#dc2626',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },
    removeButtonPressed: {
        opacity: 0.7,
        transform: [{ scale: 0.95 }],
    },
}));
