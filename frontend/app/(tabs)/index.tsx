import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PieChart, LineChart } from 'react-native-gifted-charts';
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
  const [monthly, setMonthly] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      let s = await api.getSummary();
      if (!s.net_worth_try || s.net_worth_try === 0) {
        await api.seed();
        s = await api.getSummary();
      }
      setSummary(s);
      const m = await api.getMonthlyStats(6);
      setMonthly(m);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
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

  const lineData = useMemo(() => {
    return monthly.map(m => ({
      value: Math.round(fromTry(m.net)),
      label: m.label,
      labelTextStyle: { color: theme.colors.onSurfaceMuted, fontSize: 10 },
      dataPointText: '',
      frontColor: m.net >= 0 ? theme.colors.success : theme.colors.danger,
    }));
  }, [monthly, fromTry]);

  const incomeData = monthly.map(m => ({ value: fromTry(m.income), label: m.label }));
  const expenseData = monthly.map(m => ({ value: fromTry(m.expense), label: m.label }));

  const netWorth = summary ? fromTry(summary.net_worth_try) : 0;
  const investPlPct = summary?.investments_pl_pct ?? 0;
  const positive = investPlPct >= 0;
  const maxAbs = Math.max(...incomeData.map(d => d.value), ...expenseData.map(d => d.value), 1);

  return (
    <ScreenContainer testID="dashboard-screen" refreshing={refreshing} onRefresh={onRefresh}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greet}>Merhaba 👋</Text>
          <Text style={styles.subgreet}>Toplam Mal Varlığı</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            testID="transfer-btn"
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/transfer'); }}
            style={styles.iconBtn}
          >
            <Ionicons name="swap-horizontal" size={20} color={theme.colors.brand} />
          </Pressable>
          <Pressable
            testID="settings-btn"
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/settings'); }}
            style={styles.iconBtn}
          >
            <Ionicons name="settings-outline" size={20} color={theme.colors.onSurface} />
          </Pressable>
        </View>
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

      {/* Breakdown cards */}
      {summary && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 8 }}>
          <BreakdownCard testID="bd-bank" label="Banka" value={fromTry(summary.breakdown.bank_try)} currency={currency} icon="business" color="#0066FF" />
          <BreakdownCard testID="bd-cash" label="Nakit" value={fromTry(summary.breakdown.cash_try)} currency={currency} icon="cash" color="#00FF94" />
          <BreakdownCard testID="bd-digital" label="Dijital" value={fromTry(summary.breakdown.digital_try)} currency={currency} icon="phone-portrait" color="#0090FF" />
          <BreakdownCard testID="bd-invest" label="Yatırım" value={fromTry(summary.breakdown.investments_try)} currency={currency} icon="trending-up" color="#FFB800" />
          <BreakdownCard testID="bd-debt" label="Kart Borcu" value={fromTry(summary.breakdown.card_debt_try)} currency={currency} icon="card" color="#FF3366" negative />
        </ScrollView>
      )}

      {/* Monthly trend */}
      {monthly.length > 0 && (
        <GlassCard style={{ marginTop: 12 }} testID="monthly-trend">
          <View style={styles.cardHead}>
            <View>
              <Text style={styles.cardTitle}>Aylık Net Akış</Text>
              <Text style={styles.cardSub}>Son {monthly.length} ay</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={styles.legendChip}><View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} /><Text style={styles.legendChipText}>Gelir</Text></View>
              <View style={styles.legendChip}><View style={[styles.legendDot, { backgroundColor: theme.colors.danger }]} /><Text style={styles.legendChipText}>Gider</Text></View>
            </View>
          </View>
          <View style={{ marginTop: 16, height: 180 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flex: 1 }}>
              {monthly.map((m, i) => {
                const inc = fromTry(m.income);
                const exp = fromTry(m.expense);
                const incH = (inc / maxAbs) * 140;
                const expH = (exp / maxAbs) * 140;
                return (
                  <View key={i} style={{ alignItems: 'center', flex: 1, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 140 }}>
                      <View style={{ width: 10, height: Math.max(2, incH), backgroundColor: theme.colors.success, borderRadius: 3, opacity: 0.9 }} />
                      <View style={{ width: 10, height: Math.max(2, expH), backgroundColor: theme.colors.danger, borderRadius: 3, opacity: 0.9 }} />
                    </View>
                    <Text style={styles.barLabel}>{m.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
          <View style={styles.netLineWrap}>
            <Text style={styles.netLineLabel}>Net</Text>
            <Text style={[styles.netLineValue, { color: lineData[lineData.length - 1]?.value >= 0 ? theme.colors.success : theme.colors.danger }]}>
              {formatMoney(lineData[lineData.length - 1]?.value || 0, currency, { decimals: 0, compact: true })}
            </Text>
          </View>
        </GlassCard>
      )}

      {/* Donut chart */}
      <GlassCard style={{ marginTop: 12 }} testID="breakdown-card">
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Varlık Dağılımı</Text>
          <Text style={styles.cardSub}>{pieData.length} kategori</Text>
        </View>
        <View style={styles.chartRow}>
          {pieData.length > 0 ? (
            <PieChart
              data={pieData}
              donut
              radius={80}
              innerRadius={56}
              backgroundColor="transparent"
              innerCircleColor={theme.colors.surfaceSecondary}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.centerSmall}>Toplam</Text>
                  <Text style={styles.centerBig}>{formatMoney(netWorth, currency, { decimals: 0, compact: true })}</Text>
                </View>
              )}
            />
          ) : (
            <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={styles.cardSub}>Veri yok</Text>
            </View>
          )}
          <View style={styles.legend}>
            {pieData.map(d => (
              <View key={d.text} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                <Text style={styles.legendLabel}>{d.text}</Text>
                <Text style={styles.legendValue}>{formatMoney(fromTry(d.value), currency, { decimals: 0, compact: true })}</Text>
              </View>
            ))}
          </View>
        </View>
      </GlassCard>

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
          <Text style={[styles.actionText, { color: theme.colors.success }]}>Yatırım</Text>
        </Pressable>
      </View>

      {/* PL summary */}
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
            <Text style={styles.kpiLabel}>Hesap Toplamı</Text>
            <Text style={styles.kpiValue}>{formatMoney(fromTry(summary.breakdown.accounts_total_try), currency, { decimals: 0, compact: true })}</Text>
            <Text style={styles.kpiSub}>{currency} cinsinden</Text>
          </GlassCard>
        </View>
      )}
    </ScreenContainer>
  );
}

function BreakdownCard({ testID, label, value, currency, icon, color, negative }: any) {
  return (
    <View testID={testID} style={[bdStyles.card, { borderColor: color + '33' }]}>
      <View style={[bdStyles.iconBox, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={bdStyles.label}>{label}</Text>
      <Text style={[bdStyles.value, negative && { color: theme.colors.danger }]}>
        {negative ? '-' : ''}{formatMoney(value, currency, { decimals: 0, compact: true })}
      </Text>
    </View>
  );
}

const bdStyles = StyleSheet.create({
  card: { width: 130, padding: 14, borderRadius: 18, backgroundColor: theme.colors.glass, borderWidth: 1, gap: 8 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { color: theme.colors.onSurface, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 16 },
  greet: { color: theme.colors.onSurface, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subgreet: { color: theme.colors.onSurfaceMuted, fontSize: 13, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glass },
  hero: { alignItems: 'center', paddingVertical: 20 },
  netWorth: { color: '#FFFFFF', fontSize: 46, fontWeight: '900', letterSpacing: -1.5, textShadowColor: 'rgba(0,102,255,0.5)', textShadowRadius: 24, textShadowOffset: { width: 0, height: 0 } },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: theme.colors.onSurface, fontSize: 16, fontWeight: '700' },
  cardSub: { color: theme.colors.onSurfaceMuted, fontSize: 12 },
  chartRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  centerSmall: { color: theme.colors.onSurfaceMuted, fontSize: 10, fontWeight: '600' },
  centerBig: { color: theme.colors.onSurface, fontSize: 16, fontWeight: '800', marginTop: 2 },
  legend: { flex: 1, paddingLeft: 16, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendLabel: { color: theme.colors.onSurfaceMuted, fontSize: 12, flex: 1 },
  legendValue: { color: theme.colors.onSurface, fontSize: 12, fontWeight: '700' },
  legendChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.glass, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border },
  legendChipText: { color: theme.colors.onSurfaceMuted, fontSize: 10, fontWeight: '700' },
  barLabel: { color: theme.colors.onSurfaceMuted, fontSize: 10, fontWeight: '600' },
  netLineWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.divider },
  netLineLabel: { color: theme.colors.onSurfaceMuted, fontSize: 12, fontWeight: '700' },
  netLineValue: { fontSize: 16, fontWeight: '800' },
  kpisRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  kpiCard: { flex: 1 },
  kpiLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: 22, fontWeight: '800', marginTop: 6, letterSpacing: -0.5, color: theme.colors.onSurface },
  kpiSub: { fontSize: 11, marginTop: 4, color: theme.colors.onSurfaceMuted, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16 },
  actionGhost: { backgroundColor: 'rgba(0,255,148,0.12)', borderWidth: 1, borderColor: 'rgba(0,255,148,0.35)' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
