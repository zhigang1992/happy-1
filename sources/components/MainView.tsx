import * as React from 'react';
import { View, ActivityIndicator, TextInput } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useRealtimeStatus } from '@/sync/storage';
import { useVisibleSessionListViewData } from '@/hooks/useVisibleSessionListViewData';
import { useIsTablet } from '@/utils/responsive';
import { EmptySessionsTablet } from './EmptySessionsTablet';
import { SessionsList } from './SessionsList';
import { VoiceAssistantStatusBar } from './VoiceAssistantStatusBar';
import { SessionsListWrapper } from './SessionsListWrapper';
import { FABWide } from './FABWide';
import { Typography } from '@/constants/Typography';
import { t } from '@/text';
import { useRouter } from 'expo-router';

interface MainViewProps {
    variant: 'phone' | 'sidebar';
}

const styles = StyleSheet.create((theme) => ({
    container: {
        flex: 1,
    },
    phoneContainer: {
        flex: 1,
    },
    sidebarContentContainer: {
        flex: 1,
        flexBasis: 0,
        flexGrow: 1,
    },
    loadingContainerWrapper: {
        flex: 1,
        flexBasis: 0,
        flexGrow: 1,
        backgroundColor: theme.colors.groupped.background,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 32,
    },
    tabletLoadingContainer: {
        flex: 1,
        flexBasis: 0,
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyStateContainer: {
        flex: 1,
        flexBasis: 0,
        flexGrow: 1,
        flexDirection: 'column',
        backgroundColor: theme.colors.groupped.background,
    },
    emptyStateContentContainer: {
        flex: 1,
        flexBasis: 0,
        flexGrow: 1,
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: theme.colors.groupped.background,
    },
    searchInput: {
        backgroundColor: theme.colors.surface,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: theme.colors.text,
        ...Typography.default(),
    },
}));


export const MainView = React.memo(({ variant }: MainViewProps) => {
    const { theme } = useUnistyles();
    const sessionListViewData = useVisibleSessionListViewData();
    const isTablet = useIsTablet();
    const realtimeStatus = useRealtimeStatus();
    const router = useRouter();
    const [searchQuery, setSearchQuery] = React.useState('');

    const handleNewSession = React.useCallback(() => {
        router.push('/new');
    }, [router]);

    // Sidebar variant
    if (variant === 'sidebar') {
        // Loading state
        if (sessionListViewData === null) {
            return (
                <View style={styles.sidebarContentContainer}>
                    <View style={styles.tabletLoadingContainer}>
                        <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                    </View>
                </View>
            );
        }

        // Empty state
        if (sessionListViewData.length === 0) {
            return (
                <View style={styles.sidebarContentContainer}>
                    <View style={styles.emptyStateContainer}>
                        <EmptySessionsTablet />
                    </View>
                </View>
            );
        }

        // Sessions list with search
        return (
            <View style={styles.sidebarContentContainer}>
                <View style={styles.searchContainer}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('session.searchPlaceholder')}
                        placeholderTextColor={theme.colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                        spellCheck={false}
                        returnKeyType="search"
                    />
                </View>
                <SessionsList searchQuery={searchQuery} />
            </View>
        );
    }

    // Phone variant
    // Tablet in phone mode - special case (when showing index view on tablets, show empty view)
    if (isTablet) {
        // Just show an empty view on tablets for the index view
        // The sessions list is shown in the sidebar, so the main area should be blank
        return <View style={styles.emptyStateContentContainer} />;
    }

    // Phone mode - show sessions list directly (no tabs)
    return (
        <>
            {realtimeStatus !== 'disconnected' && (
                <VoiceAssistantStatusBar variant="full" />
            )}
            <View style={styles.phoneContainer}>
                <SessionsListWrapper />
            </View>
            <FABWide onPress={handleNewSession} />
        </>
    );
});
