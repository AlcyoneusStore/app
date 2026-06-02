import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ScreenContainer from '@/src/components/ScreenContainer';
import GlassCard from '@/src/components/GlassCard';
import { useCurrency, formatMoney } from '@/src/contexts/CurrencyContext';
import { api } from '@/src/api';
import { theme, CATEGORIES } from '@/src/theme';

type RangeKey = 'day' | 'week' | 'month';

export default function ExpensesScreen() {
  const [txs, setTxs] = useState<any[]>([]);
  const [range, setRange] = useState<RangeKey>('month');
  const [activeCat, setActiveCat] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { currency, fromTry } = useCurrency();
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const data = await api.listTransactions({ type: 'expense' });
      setTxs(data);
    } catch (e) {
      console.warn(e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff = range === 'day' ? 1 : range === 'week' ? 7 : 31;
    return txs.filter(t => {
      const d = new Date(t.date).getTime();
      const daysAgo = (now - d) / (1000 * 60 * 60 * 24);
      if (daysAgo > cutoff) return false;
      if (activeCat !== 'All' && t.category !== activeCat) return false;
      if (search && !((t.note || '').toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()))) return false;
      return true;
    });
  }, [txs, range, activeCat, search]);

  const total = filtered.reduce((s, t) => s + t.amount_try, 0);

  // category aggregation
  const catAgg = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(t => {
      map.set(t.category, (map.get(t.category) || 0) + t.amount_try);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const onRefresh = () => { setRefreshing(true); load(); };
  const maxCat = catAgg[0]?.[1] || 1;

  return (
    <ScreenContainer testID="expenses-screen" refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Harcamalar</Text>
        <Pressable
          testID="add-expense-btn"
          style={styles.addBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/add-transaction'); }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Range selector */}
      <View style={styles.rangeWrap}>
        {(['day', 'week', 'month'] as RangeKey[]).map(r => (
          <Pressable
            key={r}
            testID={`range-${r}`}
            onPress={() => { Haptics.selectionAsync(); setRange(r); }}
            style={[styles.rangeBtn, range === r && styles.rangeActive]}
          >
            <Text style={[styles.rangeLabel, range === r && styles.rangeLabelActive]}>
              {r === 'day' ? 'Günlük' : r === 'week' ? 'Haftalık' : 'Aylık'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Big total */}
      <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 8 }}>
        <Text style={styles.totalLabel}>Toplam Harcama</Text>
        <Text style={styles.totalValue} testID="expenses-total">
          {formatMoney(fromTry(total), currency, { decimals: 2 })}
        </Text>
        <Text style={styles.totalCount}>{filtered.length} işlem</Text>
      </View>

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
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {['All', ...CATEGORIES.filter(c => !['Maaş', 'Freelance'].includes(c.id)).map(c => c.id)].map(c => {
          const active = activeCat === c;
          const def = CATEGORIES.find(x => x.id === c);
          return (
            <Pressable
              key={c}
              testID={`cat-chip-${c}`}
              onPress={() => { Haptics.selectionAsync(); setActiveCat(c); }}
              style={[styles.chip, active && { backgroundColor: theme.colors.brandTint, borderColor: theme.colors.brand }]}
            >
              {def && <View style={[styles.chipDot, { backgroundColor: def.color }]} />}
              <Text style={[styles.chipLabel, active && { color: theme.colors.brand }]}>
                {c === 'All' ? 'Tümü' : c}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Category breakdown */}
      {catAgg.length > 0 && (
        <GlassCard style={{ marginTop: 16 }}>
          <Text style={styles.cardTitle}>Kategoriler</Text>
          <View style={{ marginTop: 12, gap: 12 }}>
            {catAgg.map(([cat, amt]) => {
              const def = CATEGORIES.find(c => c.id === cat);
              const pct = (amt / maxCat) * 100;
              return (
                <View key={cat}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.catIcon, { backgroundColor: (def?.color || '#999') + '22' }]}>
                        <Ionicons name={(def?.icon as any) || 'ellipsis-horizontal'} size={14} color={def?.color || '#999'} />
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

      {/* List */}
      <Text style={[styles.cardTitle, { marginTop: 20, marginBottom: 12 }]}>Son İşlemler</Text>
      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={<Text style={{ color: theme.colors.onSurfaceMuted, textAlign: 'center', paddingVertical: 24 }}>Bu dönemde işlem yok</Text>}
        renderItem={({ item }) => {
          const def = CATEGORIES.find(c => c.id === item.category);
          return (
            <GlassCard testID={`tx-${item.id}`} style={{ padding: 0 }}>
              <View style={styles.txRow}>
                <View style={[styles.catIcon, { backgroundColor: (def?.color || '#999') + '22', width: 40, height: 40, borderRadius: 12 }]}>
                  <Ionicons name={(def?.icon as any) || 'ellipsis-horizontal'} size={18} color={def?.color || '#999'} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.txCat}>{item.category}</Text>
                  <Text style={styles.txNote} numberOfLines={1}>{item.note || new Date(item.date).toLocaleDateString('tr-TR')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.txAmount}>
                    -{formatMoney(item.amount, item.currency, { decimals: 2 })}
                  </Text>
                  {item.currency !== currency && (
                    <Text style={styles.txSub}>
                      ≈ {formatMoney(fromTry(item.amount_try), currency, { decimals: 2 })}
                    </Text>
                  )}
                </View>
              </View>
            </GlassCard>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 12 },
  title: { color: theme.colors.onSurface, fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.brand, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  rangeWrap: { flexDirection: 'row', backgroundColor: theme.colors.glass, borderRadius: theme.radius.pill, padding: 4, borderWidth: 1, borderColor: theme.colors.border },
  rangeBtn: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.pill, alignItems: 'center' },
  rangeActive: { backgroundColor: theme.colors.brand },
  rangeLabel: { color: theme.colors.onSurfaceMuted, fontSize: 13, fontWeight: '700' },
  rangeLabelActive: { color: '#fff' },
  totalLabel: { color: theme.colors.onSurfaceMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  totalValue: { color: theme.colors.danger, fontSize: 40, fontWeight: '900', letterSpacing: -1, marginTop: 6, textShadowColor: 'rgba(255,51,102,0.4)', textShadowRadius: 16 },
  totalCount: { color: theme.colors.onSurfaceMuted, fontSize: 13, marginTop: 4 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 14, marginTop: 16, height: 44 },
  searchInput: { flex: 1, color: theme.colors.onSurface, fontSize: 14 },
  chipRow: { paddingVertical: 12, paddingRight: 8, gap: 8 },
  chip: { flexShrink: 0, height: 36, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: theme.radius.pill, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { color: theme.colors.onSurfaceMuted, fontSize: 13, fontWeight: '700' },
  cardTitle: { color: theme.colors.onSurface, fontSize: 16, fontWeight: '700' },
  catIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catLabel: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '600' },
  catValue: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '700' },
  bar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  txRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  txCat: { color: theme.colors.onSurface, fontSize: 14, fontWeight: '700' },
  txNote: { color: theme.colors.onSurfaceMuted, fontSize: 12, marginTop: 2 },
  txAmount: { color: theme.colors.danger, fontSize: 15, fontWeight: '800' },
  txSub: { color: theme.colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
});
