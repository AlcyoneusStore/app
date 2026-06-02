import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { theme } from '@/src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.brand,
        tabBarInactiveTintColor: theme.colors.onSurfaceDim,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Platform.OS === 'ios' ? 24 : 16,
          marginHorizontal: 16,
          borderRadius: 28,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: theme.colors.border,
          height: 68,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 14 : 10,
          backgroundColor: Platform.OS === 'android' ? 'rgba(10,14,39,0.95)' : 'transparent',
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <View style={StyleSheet.absoluteFillObject}>
              <BlurView intensity={50} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 28, overflow: 'hidden' }]} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,14,39,0.7)', borderRadius: 28 }]} />
            </View>
          ) : null,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Panel',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Cüzdan',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Harcamalar',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="investments"
        options={{
          title: 'Yatırımlar',
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
