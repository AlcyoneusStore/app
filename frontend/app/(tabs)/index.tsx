import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PieChart, LineChart } from 'react-native-gifted-charts';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ScreenContainer from '@/src/components/ScreenContainer';
import GlassCard from '@/src/components/GlassCard';
import CurrencyToggle from '@/src/components/CurrencyToggle';
import { useCurrency, formatMoney } from '@/src/contexts/CurrencyContext';
import { api } from '@/src/api';
import { theme } from '@/src/theme';

type DetailKey = 'bank' | 'cash' | 'digital' | 'invest' | 'debt' | 'monthly' | 'snapshot' | null;

export default function DashboardScreen() {
  const { currency, fromTry, refresh: refreshRates } = useCurrency();
  const [summary, setSummary] = useState<any>(null);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [snapPeriod, setSnapPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [investments, setInvestments] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [detail, setDetail] = useState<DetailKey>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const [s, m, sn, txs, accs, invs, crs, cats] = await Promise.all([
        api.getSummary(), api.getMonthlyStats(6), api.getSnapshots(snapPeriod),
        api.listTransactions({ limit: 100 } as any), api.listAccounts(), api.listInvestments(),
        api.listCards(), api.listCategories(),
      ]);
      setSummary(s); setMonthly(m); setSnapshots(sn);
      setTransactions(txs); setAccounts(accs); setInvestments(invs); setCards(crs); setCategories(cats);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [snapPeriod]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

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

  // Bu ay summary
  const thisMonth = useMemo(() => {
    if (!monthly.length) return null;
    return monthly[monthly.length - 1];
  }, [monthly]);

  const savingsRate = useMemo(() => {
    if (!thisMonth || thisMonth.income <= 0) return 0;
    return ((thisMonth.income - thisMonth.expense) / thisMonth.income) * 100;
  }, [thisMonth]);

  // Top categories this month (expense)
  const topCategories = useMemo(() => {
    if (!thisMonth) return [];
    const startMonth = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).getTime();
    const map = new Map<string, number>();
    transactions.forEach(t => {
      if (t.type !== 'expense') return;
      const d = new Date(t.date).getTime();
      if (d < startMonth) return;
      map.set(t.category, (map.get(t.category) || 0) + t.amount_try);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [transactions, thisMonth]);

  const netWorth = summary ? fromTry(summary.net_worth_try) : 0;
  const investPlPct = summary?.investments_pl_pct ?? 0;
  const positive = investPlPct >= 0;
  const maxAbs = Math.max(...monthly.map(m => Math.max(fromTry(m.income), fromTry(m.expense))), 1);

  return (
    <>
    <ScreenContainer testID="dashboard-screen" refreshing={refreshing} onRefresh={onRefresh}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greet}>Merhaba 👋</Text>
          <Text style={styles.subgreet}>Toplam Mal Varlığı</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable testID="transfer-btn" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/transfer'); }} style={styles.iconBtn}>
            <Ionicons name="swap-horizontal" size={20} color={theme.colors.brand} />
          </Pressable>
          <Pressable testID="settings-btn" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/settings'); }} style={styles.iconBtn}>
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

      {/* Breakdown cards - tappable */}
      {summary && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 8 }}>
          <BdCard testID="bd-bank" label="Banka" value={fromTry(summary.breakdown.bank_try)} currency={currency} icon="business" color="#0066FF" onPress={() => { Haptics.selectionAsync(); setDetail('bank'); }} />
          <BdCard testID="bd-cash" label="Nakit" value={fromTry(summary.breakdown.cash_try)} currency={currency} icon="cash" color="#00FF94" onPress={() => { Haptics.selectionAsync(); setDetail('cash'); }} />
          <BdCard testID="bd-digital" label="Dijital" value={fromTry(summary.breakdown.digital_try)} currency={currency} icon="phone-portrait" color="#0090FF" onPress={() => { Haptics.selectionAsync(); setDetail('digital'); }} />
          <BdCard testID="bd-invest" label="Yatırım" value={fromTry(summary.breakdown.investments_try)} currency={currency} icon="trending-up" color="#FFB800" onPress={() => { Haptics.selectionAsync(); setDetail('invest'); }} />
          <BdCard testID="bd-debt" label="Kart Borcu" value={fromTry(summary.breakdown.card_debt_try)} currency={currency} icon="card" color="#FF3366" negative onPress={() => { Haptics.selectionAsync(); setDetail('debt'); }} />
        </ScrollView>
      )}

      {/* Bu Ay summary */}
      {thisMonth && (
        <Pressable testID="this-month-card" onPress={() => router.push('/expenses')} style={{ marginTop: 12 }}>
          <GlassCard>
            <View style={styles.cardHead}>
              <View>
                <Text style={styles.cardTitle}>Bu Ay</Text>
                <Text style={styles.cardSub}>{thisMonth.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurfaceMuted} />
            </View>
            <View style={styles.monthRow}>
              <View style={styles.monthStat}>
                <Text style={styles.statLabel}>Gelir</Text>
                <Text style={[styles.statValue, { color: theme.colors.success }]}>
                  +{formatMoney(fromTry(thisMonth.income), currency, { decimals: 0, compact: true })}
                </Text>
              </View>
              <View style={[styles.divider]} />
              <View style={styles.monthStat}>
                <Text style={styles.statLabel}>Gider</Text>
                <Text style={[styles.statValue, { color: theme.colors.danger }]}>
                  -{formatMoney(fromTry(thisMonth.expense), currency, { decimals: 0, compact: true })}
                </Text>
              </View>
              <View style={[styles.divider]} />
              <View style={styles.monthStat}>
                <Text style={styles.statLabel}>Tasarruf</Text>
                <Text style={[styles.statValue, { color: savingsRate >= 0 ? theme.colors.success : theme.colors.danger }]}>
                  {savingsRate.toFixed(0)}%
                </Text>
              </View>
            </View>
          </GlassCard>
        </Pressable>
      )}

      {/* Monthly trend - tappable */}
      {monthly.length > 0 && (
        <Pressable onPress={() => { Haptics.selectionAsync(); setDetail('monthly'); }} style={{ marginTop: 12 }}>
          <GlassCard testID="monthly-trend">
            <View style={styles.cardHead}>
              <View>
                <Text style={styles.cardTitle}>Nakit Akışı</Text>
                <Text style={styles.cardSub}>Son {monthly.length} ay · detay için dokun</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View style={styles.legendChip}><View style={[styles.legendDot, { backgroundColor: theme.colors.success }]} /><Text style={styles.legendChipText}>Gelir</Text></View>
                <View style={styles.legendChip}><View style={[styles.legendDot, { backgroundColor: theme.colors.danger }]} /><Text style={styles.legendChipText}>Gider</Text></View>
              </View>
            </View>
            <View style={{ marginTop: 16, height: 170 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flex: 1 }}>
                {monthly.map((m, i) => {
                  const inc = fromTry(m.income);
                  const exp = fromTry(m.expense);
                  const incH = (inc / maxAbs) * 130;
                  const expH = (exp / maxAbs) * 130;
                  return (
                    <View key={i} style={{ alignItems: 'center', flex: 1, gap: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 130 }}>
                        <View style={{ width: 10, height: Math.max(2, incH), backgroundColor: theme.colors.success, borderRadius: 3 }} />
                        <View style={{ width: 10, height: Math.max(2, expH), backgroundColor: theme.colors.danger, borderRadius: 3 }} />
                      </View>
                      <Text style={styles.barLabel}>{m.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </GlassCard>
        </Pressable>
      )}

      {/* Top categories table */}
      {topCategories.length > 0 && (
        <Pressable onPress={() => router.push('/expenses')} style={{ marginTop: 12 }}>
          <GlassCard testID="top-cats">
            <View style={styles.cardHead}>
              <View>
                <Text style={styles.cardTitle}>Bu Ay En Çok Harcanan</Text>
                <Text style={styles.cardSub}>Top {topCategories.length} kategori</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurfaceMuted} />
            </View>
            <View style={{ marginTop: 12, gap: 10 }}>
              {topCategories.map(([cat, amt], idx) => {
                const def = categories.find(c => c.name === cat);
                const pct = (amt / topCategories[0][1]) * 100;
                return (
                  <View key={cat}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.catIcon, { backgroundColor: (def?.color || '#999') + '22' }]}>
                          <Ionicons name={(def?.icon as any) || 'pricetag'} size={12} color={def?.color || '#999'} />
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
        </Pressable>
      )}

      {/* Investment snapshots */}
      {snapshots.length > 1 && (
        <Pressable onPress={() => router.push('/(tabs)/investments')} style={{ marginTop: 12 }}>
          <GlassCard testID="snapshot-chart">
            <View style={styles.cardHead}>
              <View>
                <Text style={styles.cardTitle}>Yatırım Değişimi</Text>
                <Text style={styles.cardSub}>{snapPeriod === 'monthly' ? 'Aylık' : 'Yıllık'} portföy değeri</Text>
              </View>
              <View style={{ flexDirection: 'row', backgroundColor: theme.colors.glass, borderRadius: theme.radius.pill, padding: 3, borderWidth: 1, borderColor: theme.colors.border }}>
                {(['monthly', 'yearly'] as const).map(p => (
                  <Pressable key={p} testID={`snap-${p}`} onPress={(e) => { e.stopPropagation && e.stopPropagation(); Haptics.selectionAsync(); setSnapPeriod(p); }} style={[{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill }, snapPeriod === p && { backgroundColor: theme.colors.brand }]}>
                    <Text style={{ color: snapPeriod === p ? '#fff' : theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700' }}>{p === 'monthly' ? 'Ay' : 'Yıl'}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <LineChart
                data={snapshots.map(s => ({ value: Math.round(fromTry(s.value_try)) }))}
                color={theme.colors.success}
                thickness={3}
                startFillColor={theme.colors.success}
                endFillColor={theme.colors.surface}
                startOpacity={0.4}
                endOpacity={0.05}
                areaChart
                hideDataPoints={false}
                dataPointsColor={theme.colors.success}
                dataPointsRadius={3}
                yAxisColor="transparent"
                xAxisColor="transparent"
                yAxisTextStyle={{ color: theme.colors.onSurfaceMuted, fontSize: 9 }}
                hideRules
                backgroundColor="transparent"
                width={290}
                height={120}
                spacing={Math.max(20, 290 / Math.max(snapshots.length - 1, 1))}
                initialSpacing={10}
                endSpacing={0}
                noOfSections={3}
                maxValue={Math.max(...snapshots.map(s => fromTry(s.value_try))) * 1.1}
              />
            </View>
            <View style={styles.netLineWrap}>
              <Text style={styles.netLineLabel}>En Son</Text>
              <Text style={[styles.netLineValue, { color: theme.colors.success }]}>
                {formatMoney(fromTry(snapshots[snapshots.length - 1]?.value_try || 0), currency, { decimals: 0, compact: true })}
              </Text>
            </View>
          </GlassCard>
        </Pressable>
      )}

      {/* Donut chart - tappable */}
      <Pressable testID="breakdown-card" onPress={() => { Haptics.selectionAsync(); setDetail('snapshot'); }} style={{ marginTop: 12 }}>
        <GlassCard>
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
      </Pressable>

      {/* Quick actions */}
      <View style={styles.actionsRow}>
        <Pressable testID="add-transaction-btn" style={[styles.actionBtn, { backgroundColor: theme.colors.brand }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/add-transaction'); }}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.actionText}>İşlem Ekle</Text>
        </Pressable>
        <Pressable testID="add-investment-btn" style={[styles.actionBtn, styles.actionGhost]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/add-investment'); }}>
          <Ionicons name="trending-up" size={18} color={theme.colors.success} />
          <Text style={[styles.actionText, { color: theme.colors.success }]}>Yatırım</Text>
        </Pressable>
      </View>

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

    {/* Detail modal */}
    <DetailModal
      detail={detail}
      onClose={() => setDetail(null)}
      summary={summary}
      monthly={monthly}
      accounts={accounts}
      investments={investments}
      cards={cards}
      router={router}
    />
    </>
  );
}

function BdCard({ testID, label, value, currency, icon, color, negative, onPress }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[bd.card, { borderColor: color + '33' }]}>
      <View style={[bd.iconBox, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={bd.label}>{label}</Text>
      <Text style={[bd.value, negative && { color: theme.colors.danger }]}>
        {negative ? '-' : ''}{formatMoney(value, currency, { decimals: 0, compact: true })}
      </Text>
      <View style={bd.tapHint}>
        <Ionicons name="chevron-forward" size={11} color={theme.colors.onSurfaceMuted} />
      </View>
    </Pressable>
  );
}

function DetailModal({ detail, onClose, summary, monthly, accounts, investments, cards, router }: any) {
  if (!detail) return null;
  const { currency, fromTry } = useCurrency();

  const titles: Record<string, string> = {
    bank: 'Banka Hesapları', cash: 'Nakit Hesapları', digital: 'Dijital Cüzdanlar',
    invest: 'Yatırım Detayları', debt: 'Kart Borçları', monthly: 'Aylık Detay',
    snapshot: 'Varlık Detayı',
  };

  let content: React.ReactNode = null;
  let goTo: string | null = null;
  let goLabel = '';

  if (detail === 'bank' || detail === 'cash' || detail === 'digital') {
    const items = accounts.filter((a: any) => a.type === (detail === 'bank' ? 'bank' : detail));
    content = items.length ? (
      <View style={{ gap: 10 }}>
        {items.map((a: any) => (
          <View key={a.id} style={dm.row}>
            <View style={{ flex: 1 }}>
              <Text style={dm.rowTitle}>{a.name}</Text>
              <Text style={dm.rowSub}>{a.currency}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={dm.rowValue}>{formatMoney(a.balance, a.currency, { decimals: 2 })}</Text>
              {a.currency !== currency && (
                <Text style={dm.rowSub}>≈ {formatMoney(fromTry(a.balance_try), currency, { decimals: 2 })}</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    ) : <Text style={dm.empty}>Bu kategoride hesap yok</Text>;
    goTo = '/(tabs)/wallet'; goLabel = 'Cüzdanı Aç';
  } else if (detail === 'invest') {
    content = investments.length ? (
      <View style={{ gap: 10 }}>
        {investments.slice(0, 8).map((i: any) => {
          const value = i.current_price * i.quantity;
          const cost = i.cost_basis * i.quantity;
          const pl = value - cost;
          const positive = pl >= 0;
          return (
            <View key={i.id} style={dm.row}>
              <View style={{ flex: 1 }}>
                <Text style={dm.rowTitle}>{i.name}</Text>
                <Text style={dm.rowSub}>{i.quantity} {i.symbol}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={dm.rowValue}>{formatMoney(value, i.currency, { decimals: 2 })}</Text>
                <Text style={[dm.rowSub, { color: positive ? theme.colors.success : theme.colors.danger }]}>
                  {positive ? '+' : ''}{formatMoney(pl, i.currency, { decimals: 2 })}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    ) : <Text style={dm.empty}>Yatırım yok</Text>;
    goTo = '/(tabs)/investments'; goLabel = 'Yatırımları Aç';
  } else if (detail === 'debt') {
    content = cards.length ? (
      <View style={{ gap: 10 }}>
        {cards.map((c: any) => {
          const usage = c.limit > 0 ? Math.min(100, (c.debt / c.limit) * 100) : 0;
          return (
            <View key={c.id} style={dm.row}>
              <View style={{ flex: 1 }}>
                <Text style={dm.rowTitle}>{c.name}</Text>
                <Text style={dm.rowSub}>{c.bank} · ****{c.last4} · {usage.toFixed(0)}% kullanım</Text>
              </View>
              <Text style={[dm.rowValue, { color: theme.colors.warning }]}>
                {formatMoney(c.debt, c.currency, { decimals: 2 })}
              </Text>
            </View>
          );
        })}
      </View>
    ) : <Text style={dm.empty}>Kart yok</Text>;
    goTo = '/(tabs)/wallet'; goLabel = 'Kartları Aç';
  } else if (detail === 'monthly') {
    content = (
      <View style={{ gap: 10 }}>
        {monthly.slice().reverse().map((m: any) => (
          <View key={m.label} style={dm.row}>
            <View style={{ flex: 1 }}>
              <Text style={dm.rowTitle}>{m.label}</Text>
              <Text style={dm.rowSub}>
                Gelir: +{formatMoney(fromTry(m.income), currency, { decimals: 0, compact: true })} ·
                Gider: -{formatMoney(fromTry(m.expense), currency, { decimals: 0, compact: true })}
              </Text>
            </View>
            <Text style={[dm.rowValue, { color: m.net >= 0 ? theme.colors.success : theme.colors.danger }]}>
              {m.net >= 0 ? '+' : ''}{formatMoney(fromTry(m.net), currency, { decimals: 0, compact: true })}
            </Text>
          </View>
        ))}
      </View>
    );
    goTo = '/(tabs)/expenses'; goLabel = 'İşlemleri Aç';
  } else if (detail === 'snapshot' && summary) {
    const b = summary.breakdown;
    const rows = [
      { label: 'Banka Hesapları', value: b.bank_try, color: '#0066FF' },
      { label: 'Nakit', value: b.cash_try, color: '#00FF94' },
      { label: 'Dijital Cüzdan', value: b.digital_try, color: '#0090FF' },
      { label: 'Yatırımlar', value: b.investments_try, color: '#FFB800' },
      { label: 'Kart Borcu', value: -b.card_debt_try, color: '#FF3366' },
    ];
    content = (
      <View style={{ gap: 10 }}>
        {rows.map(r => (
          <View key={r.label} style={dm.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={[dm.dot, { backgroundColor: r.color }]} />
              <Text style={dm.rowTitle}>{r.label}</Text>
            </View>
            <Text style={[dm.rowValue, { color: r.value < 0 ? theme.colors.danger : theme.colors.onSurface }]}>
              {r.value < 0 ? '-' : ''}{formatMoney(Math.abs(fromTry(r.value)), currency, { decimals: 2 })}
            </Text>
          </View>
        ))}
        <View style={[dm.row, { borderTopWidth: 1, borderTopColor: theme.colors.divider, paddingTop: 12 }]}>
          <Text style={[dm.rowTitle, { fontWeight: '900', fontSize: 15 }]}>Net Mal Varlığı</Text>
          <Text style={[dm.rowValue, { fontSize: 18 }]}>
            {formatMoney(fromTry(summary.net_worth_try), currency, { decimals: 2 })}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Modal visible={!!detail} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={dm.backdrop} onPress={onClose} />
      <View style={dm.sheet}>
        <View style={dm.handle} />
        <View style={dm.header}>
          <Text style={dm.title}>{titles[detail!]}</Text>
          <Pressable testID="detail-close" onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={theme.colors.onSurfaceMuted} />
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ paddingVertical: 4 }}>
          {content}
        </ScrollView>
        {goTo && (
          <Pressable testID="detail-navigate" onPress={() => { onClose(); router.push(goTo); }} style={dm.cta}>
            <Text style={dm.ctaText}>{goLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const bd = StyleSheet.create({
  card: { width: 140, padding: 14, borderRadius: 18, backgroundColor: theme.colors.glass, borderWidth: 1, gap: 8 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { color: theme.colors.onSurface, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  tapHint: { position: 'absolute', top: 12, right: 12 },
});

const dm = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, borderTopWidth: 1, borderColor: theme.colors.border, maxHeight: '85%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 14, backgroundColor: theme.colors.glass, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowTitle: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '700' },
  rowSub: { color: theme.colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  rowValue: { color: theme.colors.onSurface, fontSize: 14, fontWeight: '800' },
  empty: { color: theme.colors.onSurfaceMuted, textAlign: 'center', padding: 20 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, backgroundColor: theme.colors.brand, paddingVertical: 14, borderRadius: 14 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 16 },
  greet: { color: theme.colors.onSurface, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  subgreet: { color: theme.colors.onSurfaceMuted, fontSize: 13, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glass },
  hero: { alignItems: 'center', paddingVertical: 16 },
  netWorth: { color: '#FFFFFF', fontSize: 44, fontWeight: '900', letterSpacing: -1.5, textShadowColor: 'rgba(0,102,255,0.5)', textShadowRadius: 24, textShadowOffset: { width: 0, height: 0 } },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: theme.colors.onSurface, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  cardSub: { color: theme.colors.onSurfaceMuted, fontSize: 12, marginTop: 2 },
  monthRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  monthStat: { flex: 1, alignItems: 'center' },
  statLabel: { color: theme.colors.onSurfaceMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  statValue: { fontSize: 18, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 },
  divider: { width: 1, height: 36, backgroundColor: theme.colors.border, marginHorizontal: 8 },
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
  catIcon: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  catLabel: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '600' },
  catValue: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '700' },
  bar: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
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
