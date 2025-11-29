import React, { useState, useEffect, useCallback } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Text } from '@/components/StyledText';
import { Typography } from '@/constants/Typography';
import { ItemGroup } from '@/components/ItemGroup';
import { ItemList } from '@/components/ItemList';
import { Item } from '@/components/Item';
import { RoundButton } from '@/components/RoundButton';
import { Modal } from '@/modal';
import { layout } from '@/components/layout';
import { t } from '@/text';
import { getServerUrl, setServerUrl, validateServerUrl, getServerInfo } from '@/sync/serverConfig';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@expo/vector-icons';

const stylesheet = StyleSheet.create((theme) => ({
    keyboardAvoidingView: {
        flex: 1,
    },
    itemListContainer: {
        flex: 1,
    },
    contentContainer: {
        backgroundColor: theme.colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 12,
        width: '100%',
        maxWidth: layout.maxWidth,
        alignSelf: 'center',
    },
    labelText: {
        ...Typography.default('semiBold'),
        fontSize: 12,
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: theme.colors.input.background,
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        ...Typography.mono(),
        fontSize: 14,
        color: theme.colors.input.text,
    },
    textInputValidating: {
        opacity: 0.6,
    },
    errorText: {
        ...Typography.default(),
        fontSize: 12,
        color: theme.colors.textDestructive,
        marginBottom: 12,
    },
    validatingText: {
        ...Typography.default(),
        fontSize: 12,
        color: theme.colors.status.connecting,
        marginBottom: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    buttonWrapper: {
        flex: 1,
    },
    statusText: {
        ...Typography.default(),
        fontSize: 12,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
}));

type ConnectionStatus = 'checking' | 'connected' | 'error';

export default function ServerConfigScreen() {
    const { theme } = useUnistyles();
    const styles = stylesheet;
    const router = useRouter();

    // Current server state
    const [currentServerUrl, setCurrentServerUrl] = useState(() => getServerUrl());
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');
    const [connectionError, setConnectionError] = useState<string | null>(null);

    // Input state for new server
    const [inputUrl, setInputUrl] = useState('');
    const [inputError, setInputError] = useState<string | null>(null);
    const [isValidating, setIsValidating] = useState(false);

    // Check connection to current server on mount and when it changes
    const checkCurrentConnection = useCallback(async () => {
        setConnectionStatus('checking');
        setConnectionError(null);

        try {
            const response = await fetch(currentServerUrl, {
                method: 'GET',
                headers: { 'Accept': 'text/plain' }
            });

            if (!response.ok) {
                setConnectionStatus('error');
                setConnectionError(t('server.serverReturnedError'));
                return;
            }

            const text = await response.text();
            if (!text.includes('Welcome to Happy Server!')) {
                setConnectionStatus('error');
                setConnectionError(t('server.notValidHappyServer'));
                return;
            }

            setConnectionStatus('connected');
        } catch (err) {
            setConnectionStatus('error');
            setConnectionError(t('server.failedToConnectToServer'));
        }
    }, [currentServerUrl]);

    useEffect(() => {
        checkCurrentConnection();
    }, [checkCurrentConnection]);

    const validateServer = async (url: string): Promise<boolean> => {
        try {
            setIsValidating(true);
            setInputError(null);

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'text/plain' }
            });

            if (!response.ok) {
                setInputError(t('server.serverReturnedError'));
                return false;
            }

            const text = await response.text();
            if (!text.includes('Welcome to Happy Server!')) {
                setInputError(t('server.notValidHappyServer'));
                return false;
            }

            return true;
        } catch (err) {
            setInputError(t('server.failedToConnectToServer'));
            return false;
        } finally {
            setIsValidating(false);
        }
    };

    const handleSave = async () => {
        if (!inputUrl.trim()) {
            Modal.alert(t('common.error'), t('server.enterServerUrl'));
            return;
        }

        const validation = validateServerUrl(inputUrl);
        if (!validation.valid) {
            setInputError(validation.error || t('errors.invalidFormat'));
            return;
        }

        // Validate the server
        const isValid = await validateServer(inputUrl);
        if (!isValid) {
            return;
        }

        const confirmed = await Modal.confirm(
            t('server.changeServer'),
            t('server.changeServerReload'),
            { confirmText: t('common.continue'), destructive: true }
        );

        if (confirmed) {
            setServerUrl(inputUrl);
            // Force reload the page to apply the new server URL
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.location.reload();
            } else {
                // On native, update state and re-check connection
                setCurrentServerUrl(inputUrl);
                setInputUrl('');
            }
        }
    };

    const handleReset = async () => {
        const confirmed = await Modal.confirm(
            t('server.resetToDefault'),
            t('server.resetServerReload'),
            { confirmText: t('common.reset'), destructive: true }
        );

        if (confirmed) {
            setServerUrl(null);
            // Force reload the page to apply the default server URL
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.location.reload();
            } else {
                setCurrentServerUrl(getServerUrl());
                setInputUrl('');
            }
        }
    };

    const getStatusColor = () => {
        switch (connectionStatus) {
            case 'connected': return theme.colors.status.connected;
            case 'error': return theme.colors.textDestructive;
            case 'checking': return theme.colors.status.connecting;
        }
    };

    const getStatusText = () => {
        switch (connectionStatus) {
            case 'connected': return t('server.statusConnected');
            case 'error': return connectionError || t('server.statusError');
            case 'checking': return t('server.statusChecking');
        }
    };

    const getStatusIcon = (): 'checkmark-circle' | 'alert-circle' | 'sync-circle' => {
        switch (connectionStatus) {
            case 'connected': return 'checkmark-circle';
            case 'error': return 'alert-circle';
            case 'checking': return 'sync-circle';
        }
    };

    const serverInfo = getServerInfo();

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: t('server.serverConfiguration'),
                    headerBackTitle: t('common.back'),
                }}
            />

            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ItemList style={styles.itemListContainer}>
                    {/* Current Server Status */}
                    <ItemGroup title={t('server.currentServer')}>
                        <Item
                            title={t('server.serverUrl')}
                            detail={currentServerUrl}
                            showChevron={false}
                            copy={true}
                        />
                        <Item
                            title={t('server.connectionStatus')}
                            detail={getStatusText()}
                            icon={<Ionicons name={getStatusIcon()} size={29} color={getStatusColor()} />}
                            showChevron={false}
                            onPress={checkCurrentConnection}
                        />
                        {serverInfo.isCustom && (
                            <Item
                                title={t('server.serverType')}
                                detail={t('server.customServer')}
                                showChevron={false}
                            />
                        )}
                    </ItemGroup>

                    {/* Change Server */}
                    <ItemGroup
                        title={t('server.changeServer')}
                        footer={t('server.advancedFeatureFooter')}
                    >
                        <View style={styles.contentContainer}>
                            <Text style={styles.labelText}>{t('server.newServerUrl').toUpperCase()}</Text>
                            <TextInput
                                style={[
                                    styles.textInput,
                                    isValidating && styles.textInputValidating
                                ]}
                                value={inputUrl}
                                onChangeText={(text) => {
                                    setInputUrl(text);
                                    setInputError(null);
                                }}
                                placeholder={t('common.urlPlaceholder')}
                                placeholderTextColor={theme.colors.input.placeholder}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="url"
                                editable={!isValidating}
                            />
                            {inputError && (
                                <Text style={styles.errorText}>
                                    {inputError}
                                </Text>
                            )}
                            {isValidating && (
                                <Text style={styles.validatingText}>
                                    {t('server.validatingServer')}
                                </Text>
                            )}
                            <View style={styles.buttonRow}>
                                <View style={styles.buttonWrapper}>
                                    <RoundButton
                                        title={t('server.resetToDefault')}
                                        size="normal"
                                        display="inverted"
                                        onPress={handleReset}
                                    />
                                </View>
                                <View style={styles.buttonWrapper}>
                                    <RoundButton
                                        title={isValidating ? t('server.validating') : t('common.save')}
                                        size="normal"
                                        action={handleSave}
                                        disabled={isValidating}
                                    />
                                </View>
                            </View>
                        </View>
                    </ItemGroup>

                </ItemList>
            </KeyboardAvoidingView>
        </>
    );
}
