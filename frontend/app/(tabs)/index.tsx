import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PieChart } from 'react-native-gifted-charts';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ScreenContainer from '@/src/components/ScreenContainer';
import GlassCard from '@/src/components/GlassCard';
import CurrencyToggle from '@/src/components/CurrencyToggle';
import { useCurrency, formatMoney } from '@/src/contexts/CurrencyContext';
import { api } from '@/src/api';
import { theme } from '@/src/theme';

export default function DashboardScreen() {
  const { currency, fromTry, refresh: refreshRates } = useCurrency();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      let s = await api.getSummary();
      if (!s.net_worth_try || s.net_worth_try === 0) {
        // seed once if empty
        await api.seed();
        s = await api.getSummary();
      }
      setSummary(s);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshRates();
    await load();
  }, [load, refreshRates]);

  const pieData = useMemo(() => {
    if (!summary) return [];
    const b = summary.breakdown;
    return [
      { value: b.cash_try, color: '#00FF94', text: 'Nakit' },
      { value: b.bank_try, color: '#0066FF', text: 'Banka' },
      { value: b.digital_try, color: '#0090FF', text: 'Dijital' },
      { value: b.investments_try, color: '#FFB800', text: 'Yatırım' },
    ].filter(d => d.value > 0);
  }, [summary]);

  const netWorth = summary ? fromTry(summary.net_worth_try) : 0;
  const investPlPct = summary?.investments_pl_pct ?? 0;
  const positive = investPlPct >= 0;

  return (
    <ScreenContainer testID="dashboard-screen" refreshing={refreshing} onRefresh={onRefresh}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greet}>Merhaba, Finso</Text>
          <Text style={styles.subgreet}>Toplam Mal Varlığı</Text>
        </View>
        <Pressable
          testID="seed-reset-btn"
          onPress={async () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); await api.seed(true); load(); }}
          style={styles.iconBtn}
        >
          <Ionicons name="refresh" size={20} color={theme.colors.onSurface} />
        </Pressable>
      </View>

      {/* Net worth hero */}
      <View style={styles.hero}>
        {loading ? (
          <ActivityIndicator color={theme.colors.brand} />
        ) : (
          <>
            <Text style={styles.netWorth} testID="net-worth-amount" numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(netWorth, currency, { decimals: 2 })}
            </Text>
            <View style={{ height: 12 }} />
            <CurrencyToggle />
          </>
        )}
      </View>

      {/* Donut chart */}
      <GlassCard style={styles.chartCard} testID="breakdown-card">
        <View style={styles.chartHeader}>
          <Text style={styles.cardTitle}>Varlık Dağılımı</Text>
          <Text style={styles.cardSub}>{pieData.length} kategori</Text>
        </View>
        <View style={styles.chartRow}>
          {pieData.length > 0 ? (
            <PieChart
              data={pieData}
              donut
              radius={90}
              innerRadius={62}
              backgroundColor="transparent"
              innerCircleColor={theme.colors.surfaceSecondary}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.centerSmall}>Toplam</Text>
                  <Text style={styles.centerBig}>
                    {formatMoney(netWorth, currency, { decimals: 0, compact: true })}
                  </Text>
                </View>
              )}
            />
          ) : (
            <View style={{ width: 180, height: 180, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={styles.cardSub}>Veri yok</Text>
            </View>
          )}
          <View style={styles.legend}>
            {pieData.map(d => (
              <View key={d.text} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                <Text style={styles.legendLabel}>{d.text}</Text>
                <Text style={styles.legendValue}>
                  {formatMoney(fromTry(d.value), currency, { decimals: 0, compact: true })}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </GlassCard>

      {/* Investment PL */}
      {summary && (
        <View style={styles.kpisRow}>
          <GlassCard style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Yatırım K/Z</Text>
            <Text style={[styles.kpiValue, { color: positive ? theme.colors.success : theme.colors.danger }]}>
              {positive ? '+' : ''}{investPlPct.toFixed(2)}%
            </Text>
            <Text style={[styles.kpiSub, { color: positive ? theme.colors.success : theme.colors.danger }]}>
              {positive ? '▲' : '▼'} {formatMoney(Math.abs(fromTry(summary.investments_pl_try)), currency, { decimals: 0, compact: true })}
            </Text>
          </GlassCard>
          <GlassCard style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Kart Borcu</Text>
            <Text style={[styles.kpiValue, { color: theme.colors.warning }]}>
              {formatMoney(fromTry(summary.breakdown.card_debt_try), currency, { decimals: 0, compact: true })}
            </Text>
            <Text style={styles.kpiSub}>{currency} cinsinden</Text>
          </GlassCard>
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.actionsRow}>
        <Pressable
          testID="add-transaction-btn"
          style={[styles.actionBtn, { backgroundColor: theme.colors.brand }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/add-transaction'); }}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.actionText}>İşlem Ekle</Text>
        </Pressable>
        <Pressable
          testID="add-investment-btn"
          style={[styles.actionBtn, styles.actionGhost]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/add-investment'); }}
        >
          <Ionicons name="trending-up" size={18} color={theme.colors.success} />
          <Text style={[styles.actionText, { color: theme.colors.success }]}>Yatırım Ekle</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 16 },
  greet: { color: theme.colors.onSurface, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subgreet: { color: theme.colors.onSurfaceMuted, fontSize: 13, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glass },
  hero: { alignItems: 'center', paddingVertical: 28 },
  netWorth: { color: '#FFFFFF', fontSize: 48, fontWeight: '900', letterSpacing: -1.5, textShadowColor: 'rgba(0,102,255,0.5)', textShadowRadius: 24, textShadowOffset: { width: 0, height: 0 } },
  chartCard: { marginTop: 8 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { color: theme.colors.onSurface, fontSize: 16, fontWeight: '700' },
  cardSub: { color: theme.colors.onSurfaceMuted, fontSize: 12 },
  chartRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centerSmall: { color: theme.colors.onSurfaceMuted, fontSize: 10, fontWeight: '600' },
  centerBig: { color: theme.colors.onSurface, fontSize: 18, fontWeight: '800', marginTop: 2 },
  legend: { flex: 1, paddingLeft: 16, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendLabel: { color: theme.colors.onSurfaceMuted, fontSize: 12, flex: 1 },
  legendValue: { color: theme.colors.onSurface, fontSize: 12, fontWeight: '700' },
  kpisRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  kpiCard: { flex: 1 },
  kpiLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: 22, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },
  kpiSub: { fontSize: 11, marginTop: 4, color: theme.colors.onSurfaceMuted, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16 },
  actionGhost: { backgroundColor: 'rgba(0,255,148,0.12)', borderWidth: 1, borderColor: 'rgba(0,255,148,0.35)' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
