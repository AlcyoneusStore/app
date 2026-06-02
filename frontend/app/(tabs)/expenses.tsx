import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ScreenContainer from '@/src/components/ScreenContainer';
import GlassCard from '@/src/components/GlassCard';
import { useCurrency, formatMoney } from '@/src/contexts/CurrencyContext';
import { api } from '@/src/api';
import { theme } from '@/src/theme';

type TypeKey = 'all' | 'expense' | 'income';
type RangeKey = 'day' | 'week' | 'month' | 'quarter' | 'all';

const TYPE_OPTIONS: { id: TypeKey; label: string; color: string; icon: any }[] = [
  { id: 'all', label: 'Tümü', color: theme.colors.brand, icon: 'apps' },
  { id: 'expense', label: 'Gider', color: theme.colors.danger, icon: 'arrow-down' },
  { id: 'income', label: 'Gelir', color: theme.colors.success, icon: 'arrow-up' },
];

const RANGES: { id: RangeKey; label: string; days: number | null }[] = [
  { id: 'day', label: 'Bugün', days: 1 },
  { id: 'week', label: '7 gün', days: 7 },
  { id: 'month', label: '30 gün', days: 31 },
  { id: 'quarter', label: '90 gün', days: 92 },
  { id: 'all', label: 'Tüm Zaman', days: null },
];

export default function ExpensesScreen() {
  const [allTxs, setAllTxs] = useState<any[]>([]);
  const [type, setType] = useState<TypeKey>('all');
  const [range, setRange] = useState<RangeKey>('month');
  const [activeCat, setActiveCat] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const { currency, fromTry } = useCurrency();
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const [txs, cats] = await Promise.all([api.listTransactions({}), api.listCategories()]);
      setAllTxs(txs);
      setCategories(cats);
    } catch (e) { console.warn(e); }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoffDays = RANGES.find(r => r.id === range)?.days ?? null;
    return allTxs.filter(t => {
      if (t.type === 'transfer') return type === 'all';
      if (type !== 'all' && t.type !== type) return false;
      if (cutoffDays !== null) {
        const d = new Date(t.date).getTime();
        const daysAgo = (now - d) / (1000 * 60 * 60 * 24);
        if (daysAgo > cutoffDays) return false;
      }
      if (activeCat !== 'All' && t.category !== activeCat) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!((t.note || '').toLowerCase().includes(q) || t.category.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [allTxs, type, range, activeCat, search]);

  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    filtered.forEach(t => {
      if (t.type === 'income') inc += t.amount_try;
      else if (t.type === 'expense') exp += t.amount_try;
    });
    return { income: inc, expense: exp, net: inc - exp };
  }, [filtered]);

  // Categories applicable to current type filter
  const availableCats = useMemo(() => {
    if (type === 'income') return categories.filter(c => c.kind === 'income');
    if (type === 'expense') return categories.filter(c => c.kind === 'expense');
    return categories;
  }, [categories, type]);

  // Category aggregation for non-zero amounts in filtered set
  const catAgg = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(t => {
      if (t.type === 'transfer') return;
      map.set(t.category, (map.get(t.category) || 0) + t.amount_try);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const maxCat = catAgg[0]?.[1] || 1;
  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <ScreenContainer testID="expenses-screen" refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>İşlemler</Text>
        <Pressable
          testID="add-expense-btn"
          style={styles.addBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/add-transaction'); }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Type segment */}
      <View style={styles.segment} testID="type-segment">
        {TYPE_OPTIONS.map(t => {
          const active = type === t.id;
          return (
            <Pressable
              key={t.id}
              testID={`type-${t.id}`}
              onPress={() => { Haptics.selectionAsync(); setType(t.id); setActiveCat('All'); }}
              style={[styles.segBtn, active && { backgroundColor: t.color }]}
            >
              <Ionicons name={t.icon} size={14} color={active ? '#fff' : theme.colors.onSurfaceMuted} />
              <Text style={[styles.segLabel, active && { color: '#fff' }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Range chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeRow}>
        {RANGES.map(r => {
          const active = range === r.id;
          return (
            <Pressable
              key={r.id}
              testID={`range-${r.id}`}
              onPress={() => { Haptics.selectionAsync(); setRange(r.id); }}
              style={[styles.rangeChip, active && { backgroundColor: theme.colors.brandTint, borderColor: theme.colors.brand }]}
            >
              <Text style={[styles.rangeLabel, active && { color: theme.colors.brand }]}>{r.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Hero totals */}
      <GlassCard style={{ marginTop: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroLabel}>Gelir</Text>
            <Text style={[styles.heroValue, { color: theme.colors.success }]}>
              +{formatMoney(fromTry(totals.income), currency, { decimals: 0, compact: true })}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.heroLabel}>Gider</Text>
            <Text style={[styles.heroValue, { color: theme.colors.danger }]}>
              -{formatMoney(fromTry(totals.expense), currency, { decimals: 0, compact: true })}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.heroLabel}>Net</Text>
            <Text style={[styles.heroValue, { color: totals.net >= 0 ? theme.colors.success : theme.colors.danger }]}>
              {totals.net >= 0 ? '+' : ''}{formatMoney(fromTry(totals.net), currency, { decimals: 0, compact: true })}
            </Text>
          </View>
        </View>
        <Text style={styles.heroCount}>{filtered.length} işlem</Text>
      </GlassCard>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={theme.colors.onSurfaceMuted} />
        <TextInput
          testID="expenses-search-input"
          placeholder="Ara: market, fatura..."
          placeholderTextColor={theme.colors.onSurfaceDim}
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={theme.colors.onSurfaceMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Category chips */}
      {availableCats.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable
            testID="cat-chip-All"
            onPress={() => { Haptics.selectionAsync(); setActiveCat('All'); }}
            style={[styles.chip, activeCat === 'All' && { backgroundColor: theme.colors.brandTint, borderColor: theme.colors.brand }]}
          >
            <Text style={[styles.chipLabel, activeCat === 'All' && { color: theme.colors.brand }]}>Tümü</Text>
          </Pressable>
          {availableCats.map(c => {
            const active = activeCat === c.name;
            return (
              <Pressable
                key={c.id}
                testID={`cat-chip-${c.name}`}
                onPress={() => { Haptics.selectionAsync(); setActiveCat(c.name); }}
                style={[styles.chip, active && { backgroundColor: theme.colors.brandTint, borderColor: theme.colors.brand }]}
              >
                <View style={[styles.chipDot, { backgroundColor: c.color }]} />
                <Text style={[styles.chipLabel, active && { color: theme.colors.brand }]}>{c.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Category breakdown bars */}
      {catAgg.length > 0 && (
        <GlassCard style={{ marginTop: 12 }}>
          <Text style={styles.cardTitle}>Kategori Dağılımı</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {catAgg.map(([cat, amt]) => {
              const def = categories.find(c => c.name === cat);
              const pct = (amt / maxCat) * 100;
              return (
                <View key={cat}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.catIcon, { backgroundColor: (def?.color || '#999') + '22' }]}>
                        <Ionicons name={(def?.icon as any) || 'ellipsis-horizontal'} size={12} color={def?.color || '#999'} />
                      </View>
                      <Text style={styles.catLabel}>{cat}</Text>
                    </View>
                    <Text style={styles.catValue}>{formatMoney(fromTry(amt), currency, { decimals: 0 })}</Text>
                  </View>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: def?.color || theme.colors.brand }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </GlassCard>
      )}

      {/* Transactions list (inline, no nested FlatList → fixes scroll bug) */}
      <Text style={[styles.cardTitle, { marginTop: 20, marginBottom: 12 }]}>
        İşlemler ({filtered.length})
      </Text>
      <View style={{ gap: 8 }}>
        {filtered.length === 0 ? (
          <GlassCard>
            <Text style={{ color: theme.colors.onSurfaceMuted, textAlign: 'center', paddingVertical: 12 }}>
              Bu filtrelerle eşleşen işlem bulunamadı
            </Text>
          </GlassCard>
        ) : (
          filtered.map(item => {
            const def = categories.find(c => c.name === item.category);
            const isIncome = item.type === 'income';
            const isTransfer = item.type === 'transfer';
            const sign = isIncome ? '+' : isTransfer ? '⇄' : '-';
            const color = isIncome ? theme.colors.success : isTransfer ? theme.colors.brand : theme.colors.danger;
            const payload = encodeURIComponent(JSON.stringify(item));
            return (
              <Pressable
                key={item.id}
                testID={`tx-${item.id}`}
                onPress={() => { if (!isTransfer) router.push(`/add-transaction?id=${item.id}&payload=${payload}`); }}
              >
                <GlassCard style={{ padding: 0 }}>
                  <View style={styles.txRow}>
                    <View style={[styles.txIcon, { backgroundColor: (def?.color || color) + '22' }]}>
                      <Ionicons
                        name={isTransfer ? 'swap-horizontal' : ((def?.icon as any) || 'ellipsis-horizontal')}
                        size={18}
                        color={def?.color || color}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.txCat}>{item.category}</Text>
                      <Text style={styles.txNote} numberOfLines={1}>
                        {item.note || new Date(item.date).toLocaleDateString('tr-TR')}
                        {item.source_type === 'card' ? ' · 💳' : item.source_type === 'account' && !isTransfer ? ' · 🏦' : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.txAmount, { color }]}>
                        {sign}{formatMoney(item.amount, item.currency, { decimals: 2 })}
                      </Text>
                      {item.currency !== currency && (
                        <Text style={styles.txSub}>
                          ≈ {formatMoney(fromTry(item.amount_try), currency, { decimals: 2 })}
                        </Text>
                      )}
                      <Text style={styles.txDate}>{new Date(item.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}</Text>
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            );
          })
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 12 },
  title: { color: theme.colors.onSurface, fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.brand, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  segment: { flexDirection: 'row', backgroundColor: theme.colors.glass, borderRadius: theme.radius.pill, padding: 4, borderWidth: 1, borderColor: theme.colors.border, gap: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: theme.radius.pill },
  segLabel: { color: theme.colors.onSurfaceMuted, fontSize: 13, fontWeight: '700' },
  rangeRow: { paddingVertical: 12, gap: 8 },
  rangeChip: { flexShrink: 0, height: 32, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  rangeLabel: { color: theme.colors.onSurfaceMuted, fontSize: 12, fontWeight: '700' },
  heroLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  heroValue: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  heroCount: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  divider: { width: 1, backgroundColor: theme.colors.border, marginHorizontal: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 14, marginTop: 12, height: 44 },
  searchInput: { flex: 1, color: theme.colors.onSurface, fontSize: 14 },
  chipRow: { paddingVertical: 12, paddingRight: 8, gap: 8 },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: theme.radius.pill, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { color: theme.colors.onSurfaceMuted, fontSize: 13, fontWeight: '700' },
  cardTitle: { color: theme.colors.onSurface, fontSize: 16, fontWeight: '700' },
  catIcon: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  catLabel: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '600' },
  catValue: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '700' },
  bar: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txCat: { color: theme.colors.onSurface, fontSize: 14, fontWeight: '700' },
  txNote: { color: theme.colors.onSurfaceMuted, fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '800' },
  txSub: { color: theme.colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  txDate: { color: theme.colors.onSurfaceDim, fontSize: 10, marginTop: 2, fontWeight: '600' },
});
