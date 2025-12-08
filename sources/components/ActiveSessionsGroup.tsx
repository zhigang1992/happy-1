import React from 'react';
import { View, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Text } from '@/components/StyledText';
import { useRouter } from 'expo-router';
import { Session, Machine } from '@/sync/storageTypes';
import { Ionicons } from '@expo/vector-icons';
import { getSessionName, useSessionStatus, formatPathRelativeToHome, getSessionSubtitle, formatLastSeen } from '@/utils/sessionUtils';
import { Typography } from '@/constants/Typography';
import { StatusDot } from './StatusDot';
import { useAllMachines, useSetting, useMachine } from '@/sync/storage';
import { StyleSheet } from 'react-native-unistyles';
import { isMachineOnline } from '@/utils/machineUtils';
import { machineSpawnNewSession } from '@/sync/ops';
import { storage } from '@/sync/storage';
import { Modal } from '@/modal';
import { CompactGitStatus } from './CompactGitStatus';
import { ProjectGitStatus } from './ProjectGitStatus';
import { t } from '@/text';
import { useNavigateToSession } from '@/hooks/useNavigateToSession';
import { useIsTablet } from '@/utils/responsive';

const stylesheet = StyleSheet.create((theme, runtime) => ({
    container: {
        backgroundColor: theme.colors.groupped.background,
        paddingTop: 8,
    },
    projectCard: {
        backgroundColor: theme.colors.surface,
        marginBottom: 8,
        marginHorizontal: Platform.select({ ios: 16, default: 12 }),
        borderRadius: Platform.select({ ios: 10, default: 16 }),
        overflow: 'hidden',
        shadowColor: theme.colors.shadow.color,
        shadowOffset: { width: 0, height: 0.33 },
        shadowOpacity: theme.colors.shadow.opacity,
        shadowRadius: 0,
        elevation: 1,
    },
    sectionHeader: {
        paddingTop: 12,
        paddingBottom: Platform.select({ ios: 6, default: 8 }),
        paddingHorizontal: Platform.select({ ios: 32, default: 24 }),
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    sectionHeaderPath: {
        ...Typography.default('regular'),
        color: theme.colors.groupped.sectionTitle,
        fontSize: Platform.select({ ios: 13, default: 14 }),
        lineHeight: Platform.select({ ios: 18, default: 20 }),
        letterSpacing: Platform.select({ ios: -0.08, default: 0.1 }),
        fontWeight: Platform.select({ ios: 'normal', default: '500' }),
    },
    sectionHeaderMachine: {
        ...Typography.default('regular'),
        color: theme.colors.groupped.sectionTitle,
        fontSize: Platform.select({ ios: 13, default: 14 }),
        lineHeight: Platform.select({ ios: 18, default: 20 }),
        letterSpacing: Platform.select({ ios: -0.08, default: 0.1 }),
        fontWeight: Platform.select({ ios: 'normal', default: '500' }),
        maxWidth: 150,
        textAlign: 'right',
    },
    sessionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: theme.colors.surface,
    },
    sessionRowWithBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.colors.divider,
    },
    sessionRowSelected: {
        backgroundColor: theme.colors.surfaceSelected,
    },
    sessionContent: {
        flex: 1,
        justifyContent: 'center',
    },
    sessionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    sessionTitle: {
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
        ...Typography.default('semiBold'),
    },
    sessionSubtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 2,
    },
    sessionMachineName: {
        fontSize: 13,
        color: theme.colors.text,
        ...Typography.default(),
    },
    sessionSubtitleSeparator: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        marginHorizontal: 4,
        ...Typography.default(),
    },
    sessionSubtitle: {
        fontSize: 13,
        color: theme.colors.textSecondary,
        flex: 1,
        ...Typography.default(),
    },
    statusTimestamp: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        lineHeight: 16,
        ...Typography.default(),
    },
    sessionTitleConnected: {
        color: theme.colors.text,
    },
    sessionTitleDisconnected: {
        color: theme.colors.textSecondary,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    statusDotContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 16,
        marginTop: 2,
        marginRight: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
        ...Typography.default(),
    },
    newSessionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.divider,
        backgroundColor: theme.colors.surface,
    },
    newSessionButtonDisabled: {
        opacity: 0.5,
    },
    newSessionButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    newSessionButtonIcon: {
        marginRight: 6,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    newSessionButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: theme.colors.text,
        ...Typography.default('semiBold'),
    },
    newSessionButtonTextDisabled: {
        color: theme.colors.textSecondary,
    },
    taskStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surfaceHighest,
        paddingHorizontal: 4,
        height: 16,
        borderRadius: 4,
    },
    taskStatusText: {
        fontSize: 10,
        fontWeight: '500',
        color: theme.colors.textSecondary,
        ...Typography.default(),
    },
}));

interface ActiveSessionsGroupProps {
    sessions: Session[];
    selectedSessionId?: string;
}


export function ActiveSessionsGroup({ sessions, selectedSessionId }: ActiveSessionsGroupProps) {
    const styles = stylesheet;

    // Sort sessions by lastMessageAt (newest first) - flat list, no grouping
    // Fall back to createdAt if no messages yet
    const sortedSessions = React.useMemo(() => {
        return [...sessions].sort((a, b) => {
            const aTime = a.lastMessageAt ?? a.createdAt;
            const bTime = b.lastMessageAt ?? b.createdAt;
            return bTime - aTime;
        });
    }, [sessions]);

    return (
        <View style={styles.container}>
            {sortedSessions.map((session, index) => (
                <FlatSessionRow
                    key={session.id}
                    session={session}
                    selected={selectedSessionId === session.id}
                />
            ))}
        </View>
    );
}

// Flat session row component with subtitle and timestamp - exported for use in SessionsList
export const FlatSessionRow = React.memo(({ session, selected }: { session: Session; selected?: boolean }) => {
    const styles = stylesheet;
    const sessionStatus = useSessionStatus(session);
    const sessionName = getSessionName(session);
    const sessionSubtitle = getSessionSubtitle(session);
    const navigateToSession = useNavigateToSession();
    const isTablet = useIsTablet();

    // Get machine for display name
    const machine = useMachine(session.metadata?.machineId || '');

    // Get machine name: prefer displayName, fall back to host
    const machineName = machine?.metadata?.displayName || session.metadata?.host || '';

    // Format the last message time (fall back to createdAt if no messages yet)
    const lastUpdatedText = React.useMemo(() => {
        const timestamp = session.lastMessageAt ?? session.createdAt;
        return formatLastSeen(timestamp, false);
    }, [session.lastMessageAt, session.createdAt]);

    return (
        <Pressable
            style={[
                styles.sessionRow,
                { marginHorizontal: 16, marginBottom: 8, borderRadius: 12 },
                selected && styles.sessionRowSelected
            ]}
            onPressIn={() => {
                if (isTablet) {
                    navigateToSession(session.id);
                }
            }}
            onPress={() => {
                if (!isTablet) {
                    navigateToSession(session.id);
                }
            }}
        >
            <View style={styles.sessionContent}>
                {/* Line 1: Machine name + path */}
                <View style={styles.sessionSubtitleRow}>
                    {machineName ? (
                        <>
                            <Text style={styles.sessionMachineName} numberOfLines={1}>
                                {machineName}
                            </Text>
                            <Text style={styles.sessionSubtitleSeparator}>·</Text>
                        </>
                    ) : null}
                    <Text style={styles.sessionSubtitle} numberOfLines={1}>
                        {sessionSubtitle}
                    </Text>
                </View>

                {/* Line 2: Title (up to 2 lines) */}
                <View style={styles.sessionTitleRow}>
                    <Text
                        style={[
                            styles.sessionTitle,
                            sessionStatus.isConnected ? styles.sessionTitleConnected : styles.sessionTitleDisconnected
                        ]}
                        numberOfLines={2}
                    >
                        {sessionName}
                    </Text>
                </View>

                {/* Line 3: Status with dot + timestamp */}
                <View style={styles.statusRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={styles.statusDotContainer}>
                            <StatusDot color={sessionStatus.statusDotColor} isPulsing={sessionStatus.isPulsing} />
                        </View>
                        <Text style={[
                            styles.statusText,
                            { color: sessionStatus.statusColor }
                        ]}>
                            {sessionStatus.statusText}
                        </Text>
                        <Text style={styles.statusTimestamp}>
                            {' · '}{lastUpdatedText}
                        </Text>
                    </View>

                    {/* Task status indicator */}
                    {session.todos && session.todos.length > 0 && (() => {
                        const totalTasks = session.todos.length;
                        const completedTasks = session.todos.filter(t => t.status === 'completed').length;

                        // Don't show if all tasks are completed
                        if (completedTasks === totalTasks) {
                            return null;
                        }

                        return (
                            <View style={styles.taskStatusContainer}>
                                <Ionicons
                                    name="bulb-outline"
                                    size={10}
                                    color={styles.taskStatusText.color}
                                    style={{ marginRight: 2 }}
                                />
                                <Text style={styles.taskStatusText}>
                                    {completedTasks}/{totalTasks}
                                </Text>
                            </View>
                        );
                    })()}
                </View>
            </View>
        </Pressable>
    );
});

// Compact session row component with status line (legacy, for compact view)
const CompactSessionRow = React.memo(({ session, selected, showBorder }: { session: Session; selected?: boolean; showBorder?: boolean }) => {
    const styles = stylesheet;
    const sessionStatus = useSessionStatus(session);
    const sessionName = getSessionName(session);
    const navigateToSession = useNavigateToSession();
    const isTablet = useIsTablet();

    return (
        <Pressable
            style={[
                styles.sessionRow,
                showBorder && styles.sessionRowWithBorder,
                selected && styles.sessionRowSelected
            ]}
            onPressIn={() => {
                if (isTablet) {
                    navigateToSession(session.id);
                }
            }}
            onPress={() => {
                if (!isTablet) {
                    navigateToSession(session.id);
                }
            }}
        >
            <View style={styles.sessionContent}>
                {/* Title line */}
                <View style={styles.sessionTitleRow}>
                    <Text
                        style={[
                            styles.sessionTitle,
                            sessionStatus.isConnected ? styles.sessionTitleConnected : styles.sessionTitleDisconnected
                        ]}
                        numberOfLines={2}
                    >
                        {sessionName}
                    </Text>
                </View>

                {/* Status line with dot */}
                <View style={styles.statusRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={styles.statusDotContainer}>
                            <StatusDot color={sessionStatus.statusDotColor} isPulsing={sessionStatus.isPulsing} />
                        </View>
                        <Text style={[
                            styles.statusText,
                            { color: sessionStatus.statusColor }
                        ]}>
                            {sessionStatus.statusText}
                        </Text>
                    </View>

                    {/* Status indicators on the right side */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, transform: [{ translateY: 1 }] }}>
                        {/* Draft status indicator */}
                        {session.draft && (
                            <View style={styles.taskStatusContainer}>
                                <Ionicons
                                    name="create-outline"
                                    size={10}
                                    color={styles.taskStatusText.color}
                                />
                            </View>
                        )}

                        {/* No longer showing git status per item - it's in the header */}

                        {/* Task status indicator */}
                        {session.todos && session.todos.length > 0 && (() => {
                            const totalTasks = session.todos.length;
                            const completedTasks = session.todos.filter(t => t.status === 'completed').length;

                            // Don't show if all tasks are completed
                            if (completedTasks === totalTasks) {
                                return null;
                            }

                            return (
                                <View style={styles.taskStatusContainer}>
                                    <Ionicons
                                        name="bulb-outline"
                                        size={10}
                                        color={styles.taskStatusText.color}
                                        style={{ marginRight: 2 }}
                                    />
                                    <Text style={styles.taskStatusText}>
                                        {completedTasks}/{totalTasks}
                                    </Text>
                                </View>
                            );
                        })()}
                    </View>
                </View>
            </View>
        </Pressable>
    );
});
