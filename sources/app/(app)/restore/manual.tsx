import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { RoundButton } from '@/components/RoundButton';
import { Typography } from '@/constants/Typography';
import { normalizeSecretKey } from '@/auth/secretKeyBackup';
import { authGetToken } from '@/auth/authGetToken';
import { decodeBase64, encodeBase64 } from '@/encryption/base64';
import { generateAuthKeyPair, authQRStart, QRAuthKeyPair } from '@/auth/authQRStart';
import { authQRWait } from '@/auth/authQRWait';
import { layout } from '@/components/layout';
import { Modal } from '@/modal';
import { t } from '@/text';
import { getServerUrl } from '@/sync/serverConfig';
import axios from 'axios';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { QRCode } from '@/components/qr/QRCode';

const stylesheet = StyleSheet.create((theme) => ({
    scrollView: {
        flex: 1,
        backgroundColor: theme.colors.surface,
    },
    container: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    contentWrapper: {
        width: '100%',
        maxWidth: layout.maxWidth,
        paddingVertical: 24,
    },
    instructionText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginBottom: 20,
        ...Typography.default(),
    },
    secondInstructionText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginBottom: 20,
        marginTop: 30,
        ...Typography.default(),
    },
    qrInstructions: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 16,
        lineHeight: 22,
        textAlign: 'center',
        ...Typography.default(),
    },
    textInput: {
        backgroundColor: theme.colors.input.background,
        padding: 16,
        borderRadius: 8,
        marginBottom: 24,
        fontFamily: 'IBMPlexMono-Regular',
        fontSize: 14,
        minHeight: 120,
        textAlignVertical: 'top',
        color: theme.colors.input.text,
    },
}));

export default function Restore() {
    const { theme } = useUnistyles();
    const styles = stylesheet;
    const auth = useAuth();
    const router = useRouter();
    const [restoreKey, setRestoreKey] = useState('');

    const handleRestore = async () => {
        const trimmedKey = restoreKey.trim();

        if (!trimmedKey) {
            Modal.alert(t('common.error'), t('connect.enterSecretKey'));
            return;
        }

        try {
            console.log('[Restore] Starting authentication with secret key...');
            console.log('[Restore] Input key (first 20 chars):', trimmedKey.substring(0, 20) + '...');

            // Normalize the key (handles both base64url and formatted input)
            const normalizedKey = normalizeSecretKey(trimmedKey);
            console.log('[Restore] Normalized to base64url (first 20 chars):', normalizedKey.substring(0, 20) + '...');

            // Validate the secret key format
            const secretBytes = decodeBase64(normalizedKey, 'base64url');
            console.log('[Restore] Decoded to bytes, length:', secretBytes.length);

            if (secretBytes.length !== 32) {
                throw new Error(`Invalid secret key length: expected 32 bytes, got ${secretBytes.length}`);
            }

            // Get token from secret
            console.log('[Restore] Calling authGetToken...');
            const token = await authGetToken(secretBytes);
            console.log('[Restore] Received token:', token ? 'yes (length: ' + token.length + ')' : 'no');

            if (!token) {
                throw new Error('Failed to authenticate with provided key');
            }

            // Login with new credentials
            console.log('[Restore] Logging in with credentials...');
            await auth.login(token, normalizedKey);

            console.log('[Restore] ✓ Authentication successful!');

            // Navigate to home/dashboard after successful login
            router.replace('/');

        } catch (error) {
            console.error('[Restore] ✗ Authentication failed:', error);
            console.error('[Restore] Error details:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
            });

            // Distinguish between different error types
            if (axios.isAxiosError(error)) {
                // Network or server error from authGetToken
                if (!error.response) {
                    // Network error - couldn't reach the server at all
                    const serverUrl = getServerUrl();
                    Modal.alert(t('common.error'), t('connect.serverConnectionFailed', { server: serverUrl }));
                } else if (error.response.status === 401 || error.response.status === 403) {
                    // Server rejected the credentials
                    Modal.alert(t('common.error'), t('connect.authenticationFailed'));
                } else {
                    // Other server error
                    Modal.alert(t('common.error'), t('connect.serverConnectionFailed', { server: getServerUrl() }));
                }
            } else if (error instanceof Error && error.message.includes('Invalid secret key')) {
                // Key format/validation error
                Modal.alert(t('common.error'), t('connect.invalidSecretKey'));
            } else {
                // Unknown error - show as invalid key for backwards compatibility
                Modal.alert(t('common.error'), t('connect.invalidSecretKey'));
            }
        }
    };

    return (
        <ScrollView style={styles.scrollView}>
            <View style={styles.container}>
                <View style={styles.contentWrapper}>
                    <Text style={styles.instructionText}>
                        Enter your secret key to restore access to your account.
                    </Text>

                    <TextInput
                        style={styles.textInput}
                        placeholder="XXXXX-XXXXX-XXXXX..."
                        placeholderTextColor={theme.colors.input.placeholder}
                        value={restoreKey}
                        onChangeText={setRestoreKey}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        spellCheck={false}
                        multiline={true}
                        numberOfLines={4}
                    />

                    <RoundButton
                        title={t('connect.restoreAccount')}
                        action={handleRestore}
                    />
                </View>
            </View>
        </ScrollView>
    );
}
