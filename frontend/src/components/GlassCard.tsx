import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  bordered?: boolean;
  testID?: string;
};

export default function GlassCard({ children, style, intensity = 30, bordered = true, testID }: Props) {
  return (
    <View testID={testID} style={[styles.wrap, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
        style={StyleSheet.absoluteFill}
      />
      {bordered && <View style={styles.border} pointerEvents="none" />}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: Platform.OS === 'android' ? theme.colors.surfaceSecondary : 'transparent',
  },
  content: { padding: theme.spacing.lg },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
