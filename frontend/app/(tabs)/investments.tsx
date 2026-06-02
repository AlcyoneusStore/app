import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ScreenContainer from '@/src/components/ScreenContainer';
import GlassCard from '@/src/components/GlassCard';
import { useCurrency, formatMoney } from '@/src/contexts/CurrencyContext';
import { api } from '@/src/api';
import { theme } from '@/src/theme';

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  stock: { label: 'Hisse', icon: 'trending-up', color: '#0090FF' },
  crypto: { label: 'Kripto', icon: 'logo-bitcoin', color: '#FFB800' },
  gold: { label: 'Altın', icon: 'star', color: '#FFD700' },
  fund: { label: 'Fon', icon: 'pie-chart', color: '#9F7AEA' },
};

export default function InvestmentsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('All');
  const [refreshing, setRefreshing] = useState(false);
  const { currency, fromTry, toTry } = useCurrency();
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const data = await api.listInvestments();
      setItems(data);
    } catch (e) {
      console.warn(e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = useMemo(
    () => (filter === 'All' ? items : items.filter(i => i.asset_type === filter)),
    [items, filter]
  );

  const totals = useMemo(() => {
    let value = 0, cost = 0;
    items.forEach(i => {
      value += toTry(i.current_price * i.quantity, i.currency);
      cost += toTry(i.cost_basis * i.quantity, i.currency);
    });
    return { value, cost, pl: value - cost, plPct: cost > 0 ? ((value - cost) / cost) * 100 : 0 };
  }, [items, toTry]);

  const positive = totals.pl >= 0;

  return (
    <ScreenContainer testID="investments-screen" refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Yatırımlar</Text>
        <Pressable
          testID="add-investment-btn"
          style={styles.addBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/add-investment'); }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Toplam Portföy Değeri</Text>
        <Text style={styles.heroValue} testID="portfolio-value">
          {formatMoney(fromTry(totals.value), currency, { decimals: 2 })}
        </Text>
        <View style={[styles.plChip, { backgroundColor: positive ? theme.colors.successDim : theme.colors.dangerDim, borderColor: positive ? theme.colors.success : theme.colors.danger }]}>
          <Ionicons name={positive ? 'arrow-up' : 'arrow-down'} size={14} color={positive ? theme.colors.success : theme.colors.danger} />
          <Text style={[styles.plText, { color: positive ? theme.colors.success : theme.colors.danger }]}>
            {positive ? '+' : ''}{formatMoney(Math.abs(fromTry(totals.pl)), currency, { decimals: 2 })} ({totals.plPct.toFixed(2)}%)
          </Text>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {['All', 'stock', 'crypto', 'gold', 'fund'].map(f => {
          const active = filter === f;
          const meta = TYPE_META[f];
          return (
            <Pressable
              key={f}
              testID={`inv-filter-${f}`}
              onPress={() => { Haptics.selectionAsync(); setFilter(f); }}
              style={[styles.chip, active && { backgroundColor: theme.colors.brandTint, borderColor: theme.colors.brand }]}
            >
              <Text style={[styles.chipLabel, active && { color: theme.colors.brand }]}>
                {f === 'All' ? 'Tümü' : meta?.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ marginTop: 8, gap: 12 }}>
        {filtered.length === 0 ? (
          <GlassCard>
            <Text style={{ color: theme.colors.onSurfaceMuted, textAlign: 'center' }}>Bu kategoride yatırım yok</Text>
          </GlassCard>
        ) : (
          filtered.map(inv => <InvestmentRow key={inv.id} inv={inv} />)
        )}
      </View>
    </ScreenContainer>
  );
}

function InvestmentRow({ inv }: { inv: any }) {
  const { currency, fromTry, toTry } = useCurrency();
  const meta = TYPE_META[inv.asset_type] || TYPE_META.stock;
  const valueOrig = inv.current_price * inv.quantity;
  const costOrig = inv.cost_basis * inv.quantity;
  const plOrig = valueOrig - costOrig;
  const plPct = costOrig > 0 ? (plOrig / costOrig) * 100 : 0;
  const positive = plOrig >= 0;
  const valueTry = toTry(valueOrig, inv.currency);

  return (
    <GlassCard testID={`investment-${inv.id}`} style={{ padding: 0 }}>
      <View style={styles.invRow}>
        <View style={[styles.invIcon, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.invName}>{inv.name}</Text>
          <Text style={styles.invMeta}>
            {inv.quantity} {inv.symbol} · Maliyet: {formatMoney(inv.cost_basis, inv.currency, { decimals: 2 })}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.invValue}>{formatMoney(fromTry(valueTry), currency, { decimals: 2 })}</Text>
          <Text style={[styles.invPL, { color: positive ? theme.colors.success : theme.colors.danger }]}>
            {positive ? '▲' : '▼'} {plPct.toFixed(2)}%
          </Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 12 },
  title: { color: theme.colors.onSurface, fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingVertical: 16 },
  heroLabel: { color: theme.colors.onSurfaceMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { color: theme.colors.onSurface, fontSize: 38, fontWeight: '900', marginTop: 6, letterSpacing: -1 },
  plChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill, borderWidth: 1, marginTop: 12 },
  plText: { fontSize: 13, fontWeight: '800' },
  chipRow: { paddingVertical: 12, paddingRight: 8, gap: 8 },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  chipLabel: { color: theme.colors.onSurfaceMuted, fontSize: 13, fontWeight: '700' },
  invRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  invIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1 },
  invName: { color: theme.colors.onSurface, fontSize: 15, fontWeight: '700' },
  invMeta: { color: theme.colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  invValue: { color: theme.colors.onSurface, fontSize: 15, fontWeight: '800' },
  invPL: { fontSize: 12, fontWeight: '800', marginTop: 4 },
});
