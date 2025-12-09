import * as React from 'react';
import { View, Pressable, Linking, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '../StyledText';
import { Typography } from '@/constants/Typography';

interface MarkdownImageProps {
    url: string;
    alt: string;
}

/**
 * Renders an image in markdown content.
 * Supports both remote URLs and handles loading/error states.
 * Tapping the image opens the URL in an external browser.
 */
export const MarkdownImage = React.memo(({ url, alt }: MarkdownImageProps) => {
    const { width: screenWidth } = useWindowDimensions();
    const [hasError, setHasError] = React.useState(false);
    const [aspectRatio, setAspectRatio] = React.useState<number | null>(null);

    // Maximum width for the image container (with some padding)
    const maxWidth = Math.min(screenWidth - 32, 600);

    const handlePress = React.useCallback(async () => {
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            }
        } catch (error) {
            console.error('Error opening image URL:', error);
        }
    }, [url]);

    const handleLoad = React.useCallback((event: { source: { width: number; height: number } }) => {
        const { width, height } = event.source;
        if (width > 0 && height > 0) {
            setAspectRatio(width / height);
        }
    }, []);

    const handleError = React.useCallback(() => {
        setHasError(true);
    }, []);

    if (hasError) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{alt || 'Image failed to load'}</Text>
            </View>
        );
    }

    // Calculate dimensions based on aspect ratio
    const imageWidth = maxWidth;
    const imageHeight = aspectRatio ? maxWidth / aspectRatio : 200;

    return (
        <Pressable onPress={handlePress} style={styles.container}>
            <Image
                source={{ uri: url }}
                style={[
                    styles.image,
                    {
                        width: imageWidth,
                        height: aspectRatio ? imageHeight : undefined,
                        aspectRatio: aspectRatio ?? 16 / 9
                    }
                ]}
                contentFit="contain"
                onLoad={handleLoad}
                onError={handleError}
                recyclingKey={url}
            />
            {alt ? <Text style={styles.caption}>{alt}</Text> : null}
        </Pressable>
    );
});

const styles = StyleSheet.create((theme) => ({
    container: {
        marginVertical: 8,
        alignItems: 'center',
    },
    image: {
        borderRadius: 8,
        backgroundColor: theme.colors.surfaceHigh,
        maxWidth: '100%',
    },
    caption: {
        ...Typography.default(),
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginTop: 4,
        textAlign: 'center',
    },
    errorContainer: {
        marginVertical: 8,
        padding: 16,
        backgroundColor: theme.colors.surfaceHigh,
        borderRadius: 8,
        alignItems: 'center',
    },
    errorText: {
        ...Typography.default(),
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
}));
