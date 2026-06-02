import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme, CurrencyCode } from '../theme';
import { useCurrency } from '../contexts/CurrencyContext';

const OPTIONS: CurrencyCode[] = ['TRY', 'USD', 'RUB'];

export default function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency();
  return (
    <View style={styles.wrap} testID="currency-toggle">
      {OPTIONS.map((c) => {
        const active = currency === c;
        return (
          <Pressable
            key={c}
            testID={`currency-toggle-${c.toLowerCase()}`}
            onPress={() => {
              Haptics.selectionAsync();
              setCurrency(c);
            }}
            style={[styles.item, active && styles.itemActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{c}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: theme.radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignSelf: 'center',
  },
  item: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    minWidth: 64,
    alignItems: 'center',
  },
  itemActive: {
    backgroundColor: theme.colors.brand,
    shadowColor: theme.colors.brand,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  label: { color: theme.colors.onSurfaceMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  labelActive: { color: '#FFFFFF' },
});
