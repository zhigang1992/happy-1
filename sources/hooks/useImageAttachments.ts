import * as React from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { log } from '@/log';

/**
 * Represents an attached image ready to be uploaded
 */
export interface ImageAttachment {
    /** Unique identifier for this attachment */
    id: string;
    /** Data URI for preview (data:image/...) or file URI */
    uri: string;
    /** MIME type of the image */
    mimeType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
    /** Image width in pixels */
    width: number;
    /** Image height in pixels */
    height: number;
    /** Raw binary data of the image (for encryption) */
    data: Uint8Array;
}

/**
 * Supported MIME types for image uploads
 */
const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type SupportedMimeType = typeof SUPPORTED_MIME_TYPES[number];

/**
 * Maximum image dimension (width or height) - images larger than this will be resized
 */
const MAX_IMAGE_DIMENSION = 2048;

/**
 * Maximum file size in bytes (5MB)
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Generate a unique ID for attachments
 */
function generateId(): string {
    return `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get MIME type from data URI or file extension
 */
function getMimeType(uri: string, type?: string): SupportedMimeType | null {
    if (type && SUPPORTED_MIME_TYPES.includes(type as SupportedMimeType)) {
        return type as SupportedMimeType;
    }

    // Try to extract from data URI
    const dataUriMatch = uri.match(/^data:(image\/[^;]+);/);
    if (dataUriMatch && SUPPORTED_MIME_TYPES.includes(dataUriMatch[1] as SupportedMimeType)) {
        return dataUriMatch[1] as SupportedMimeType;
    }

    // Try to extract from file extension
    const ext = uri.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        case 'gif':
            return 'image/gif';
        case 'webp':
            return 'image/webp';
        default:
            return null;
    }
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Load image dimensions from a data URI or URL
 */
async function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        if (Platform.OS === 'web') {
            const img = new Image();
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = uri;
        } else {
            // For native, use expo-image or similar
            // For now, return default dimensions
            resolve({ width: 0, height: 0 });
        }
    });
}

/**
 * Convert a File/Blob to ImageAttachment
 */
async function fileToImageAttachment(file: File): Promise<ImageAttachment | null> {
    const mimeType = getMimeType(file.name, file.type);
    if (!mimeType) {
        log.log('[useImageAttachments] Unsupported file type: ' + file.type);
        return null;
    }

    if (file.size > MAX_FILE_SIZE) {
        log.log('[useImageAttachments] File too large: ' + file.size);
        return null;
    }

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUri = e.target?.result as string;
            if (!dataUri) {
                resolve(null);
                return;
            }

            try {
                const dimensions = await getImageDimensions(dataUri);
                const base64Data = dataUri.split(',')[1];
                const data = base64ToUint8Array(base64Data);

                resolve({
                    id: generateId(),
                    uri: dataUri,
                    mimeType,
                    width: dimensions.width,
                    height: dimensions.height,
                    data,
                });
            } catch (error) {
                log.log('[useImageAttachments] Failed to process image: ' + error);
                resolve(null);
            }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

/**
 * Hook for managing image attachments in the chat input
 *
 * Features:
 * - Pick images from device gallery
 * - Paste images from clipboard (web only)
 * - Preview attached images
 * - Remove individual attachments
 * - Clear all attachments
 */
export function useImageAttachments() {
    const [attachments, setAttachments] = React.useState<ImageAttachment[]>([]);
    const [isProcessing, setIsProcessing] = React.useState(false);

    /**
     * Add an image attachment from various sources
     */
    const addAttachment = React.useCallback(async (source: File | string | ImageAttachment) => {
        setIsProcessing(true);
        try {
            let attachment: ImageAttachment | null = null;

            if (source instanceof File) {
                attachment = await fileToImageAttachment(source);
            } else if (typeof source === 'string') {
                // Handle data URI or URL
                const mimeType = getMimeType(source);
                if (mimeType && source.startsWith('data:')) {
                    const dimensions = await getImageDimensions(source);
                    const base64Data = source.split(',')[1];
                    const data = base64ToUint8Array(base64Data);
                    attachment = {
                        id: generateId(),
                        uri: source,
                        mimeType,
                        width: dimensions.width,
                        height: dimensions.height,
                        data,
                    };
                }
            } else {
                attachment = source;
            }

            if (attachment) {
                setAttachments(prev => [...prev, attachment!]);
            }
        } catch (error) {
            log.log('[useImageAttachments] Failed to add attachment: ' + error);
        } finally {
            setIsProcessing(false);
        }
    }, []);

    /**
     * Remove an attachment by ID
     */
    const removeAttachment = React.useCallback((id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    }, []);

    /**
     * Clear all attachments
     */
    const clearAttachments = React.useCallback(() => {
        setAttachments([]);
    }, []);

    /**
     * Pick an image from the device gallery
     */
    const pickImage = React.useCallback(async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets.length > 0) {
                const asset = result.assets[0];
                const mimeType = getMimeType(asset.uri, asset.mimeType ?? undefined);
                if (mimeType && asset.base64) {
                    const data = base64ToUint8Array(asset.base64);
                    const attachment: ImageAttachment = {
                        id: generateId(),
                        uri: `data:${mimeType};base64,${asset.base64}`,
                        mimeType,
                        width: asset.width,
                        height: asset.height,
                        data,
                    };
                    setAttachments(prev => [...prev, attachment]);
                }
            }
        } catch (error) {
            log.log('[useImageAttachments] Failed to pick image: ' + error);
        }
    }, []);

    /**
     * Handle paste event (web only)
     * Call this from the input's onPaste handler
     */
    const handlePaste = React.useCallback(async (event: ClipboardEvent) => {
        if (Platform.OS !== 'web') return;

        const items = event.clipboardData?.items;
        if (!items) return;

        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                event.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    await addAttachment(file);
                }
                break; // Only handle first image
            }
        }
    }, [addAttachment]);

    /**
     * Handle file input change (for file picker button)
     */
    const handleFileInputChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        for (const file of Array.from(files)) {
            if (file.type.startsWith('image/')) {
                await addAttachment(file);
            }
        }

        // Reset input so same file can be selected again
        event.target.value = '';
    }, [addAttachment]);

    return {
        /** Current list of attached images */
        attachments,
        /** Whether an image is currently being processed */
        isProcessing,
        /** Add an attachment from File, data URI, or ImageAttachment object */
        addAttachment,
        /** Remove an attachment by ID */
        removeAttachment,
        /** Clear all attachments */
        clearAttachments,
        /** Pick an image from the device gallery */
        pickImage,
        /** Handle paste event (web only) */
        handlePaste,
        /** Handle file input change event */
        handleFileInputChange,
    };
}
