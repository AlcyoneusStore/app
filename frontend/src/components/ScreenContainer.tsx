import React from 'react';
import { View, StyleSheet, StatusBar, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: any;
  testID?: string;
};

export default function ScreenContainer({ children, scroll = true, refreshing, onRefresh, contentStyle, testID }: Props) {
  return (
    <View style={styles.root} testID={testID}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.surface} />
      <LinearGradient
        colors={['#0A0E27', '#050816', '#050816']}
        style={StyleSheet.absoluteFill}
      />
      {/* atmospheric glow */}
      <View style={styles.glowTop} pointerEvents="none" />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle]}
            showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor="#fff" /> : undefined}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, contentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  safe: { flex: 1 },
  content: { paddingHorizontal: theme.spacing.lg, paddingBottom: 120 },
  glowTop: {
    position: 'absolute',
    top: -150,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: theme.colors.brand,
    opacity: 0.18,
  },
});
