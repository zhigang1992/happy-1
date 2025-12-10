import * as React from 'react';
import { View, ScrollView, Platform } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ImageThumbnail } from './ImageThumbnail';
import { ImageAttachment } from '@/hooks/useImageAttachments';

interface ImageAttachmentBarProps {
    /** List of attached images */
    attachments: ImageAttachment[];
    /** Called when an attachment should be removed */
    onRemove: (id: string) => void;
    /** Set of attachment IDs that are currently uploading */
    uploadingIds?: Set<string>;
}

/**
 * A horizontal scrollable bar showing attached image thumbnails.
 * Displayed above the chat input when images are attached.
 */
export const ImageAttachmentBar = React.memo(function ImageAttachmentBar({
    attachments,
    onRemove,
    uploadingIds,
}: ImageAttachmentBarProps) {
    if (attachments.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {attachments.map((attachment) => (
                    <View key={attachment.id} style={styles.thumbnailWrapper}>
                        <ImageThumbnail
                            uri={attachment.uri}
                            onRemove={() => onRemove(attachment.id)}
                            size={56}
                            isUploading={uploadingIds?.has(attachment.id)}
                        />
                    </View>
                ))}
            </ScrollView>
        </View>
    );
});

const styles = StyleSheet.create((theme) => ({
    container: {
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: 4,
    },
    scrollContent: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 4,
        paddingTop: 4, // Space for remove button overflow
    },
    thumbnailWrapper: {
        // Extra padding to allow remove button overflow
        paddingTop: 6,
        paddingRight: 6,
    },
}));
