import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import ScreenContainer from '@/src/components/ScreenContainer';
import GlassCard from '@/src/components/GlassCard';
import { useCurrency, formatMoney } from '@/src/contexts/CurrencyContext';
import { api } from '@/src/api';
import { theme, CurrencyCode } from '@/src/theme';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = SCREEN_W - 64;

const CARD_GRADIENTS: Record<string, [string, string, string]> = {
  blue: ['#0066FF', '#00C2FF', '#0047B3'],
  purple: ['#7928CA', '#FF0080', '#3D1976'],
  holo1: ['#0090FF', '#9F7AEA', '#00FF94'],
  holo2: ['#FF3366', '#FFB800', '#0090FF'],
};

export default function WalletScreen() {
  const [tab, setTab] = useState<'accounts' | 'cards'>('accounts');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { currency, fromTry, toTry } = useCurrency();
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([api.listAccounts(), api.listCards()]);
      setAccounts(a);
      setCards(c);
    } catch (e) { console.warn(e); } finally { setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Reload on focus
  useEffect(() => {
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const totalAccountsTry = accounts.reduce((s, a) => s + (a.balance_try || 0), 0);
  const totalDebtTry = cards.reduce((s, c) => s + toTry(c.debt, c.currency), 0);

  const openAccount = (acc: any | null) => {
    const payload = acc ? encodeURIComponent(JSON.stringify(acc)) : '';
    router.push(acc ? `/edit-account?id=${acc.id}&payload=${payload}` : '/edit-account');
  };
  const openCard = (card: any | null) => {
    const payload = card ? encodeURIComponent(JSON.stringify(card)) : '';
    router.push(card ? `/edit-card?id=${card.id}&payload=${payload}` : '/edit-card');
  };

  return (
    <ScreenContainer testID="wallet-screen" refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Cüzdan</Text>
        <Pressable
          testID="wallet-add-btn"
          style={styles.addBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); tab === 'accounts' ? openAccount(null) : openCard(null); }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.segmentWrap}>
        {(['accounts', 'cards'] as const).map(s => (
          <Pressable
            key={s}
            testID={`wallet-segment-${s}`}
            onPress={() => { Haptics.selectionAsync(); setTab(s); }}
            style={[styles.segment, tab === s && styles.segmentActive]}
          >
            <Text style={[styles.segmentLabel, tab === s && styles.segmentLabelActive]}>
              {s === 'accounts' ? 'Hesaplar' : 'Kartlar'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'accounts' ? (
        <>
          <GlassCard style={{ marginTop: 16 }}>
            <Text style={styles.kpiLabel}>Toplam Hesap Bakiyesi</Text>
            <Text style={styles.kpiValue}>{formatMoney(fromTry(totalAccountsTry), currency)}</Text>
            <Text style={styles.kpiSub}>{accounts.length} hesap · Düzenlemek için dokun</Text>
          </GlassCard>

          <View style={{ marginTop: 16, gap: 12 }}>
            {accounts.map((a) => <AccountRow key={a.id} account={a} displayCurrency={currency} onPress={() => openAccount(a)} />)}
          </View>
        </>
      ) : (
        <>
          <GlassCard style={{ marginTop: 16 }}>
            <Text style={styles.kpiLabel}>Toplam Kart Borcu</Text>
            <Text style={[styles.kpiValue, { color: theme.colors.warning }]}>{formatMoney(fromTry(totalDebtTry), currency)}</Text>
            <Text style={styles.kpiSub}>{cards.length} kart · Düzenlemek için dokun</Text>
          </GlassCard>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 16, paddingRight: 16, gap: 16 }}
            decelerationRate="fast"
            snapToInterval={CARD_W + 16}
          >
            {cards.map(c => <HoloCard key={c.id} card={c} width={CARD_W} onPress={() => openCard(c)} />)}
          </ScrollView>

          <View style={{ marginTop: 16, gap: 12 }}>
            {cards.map(c => <CardDetailRow key={c.id} card={c} onPress={() => openCard(c)} />)}
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

function AccountRow({ account, displayCurrency, onPress }: any) {
  const { fromTry } = useCurrency();
  const iconName = account.type === 'cash' ? 'cash' : account.type === 'digital' ? 'phone-portrait' : 'business';
  return (
    <Pressable testID={`account-${account.id}`} onPress={onPress}>
      <GlassCard style={{ padding: 0 }}>
        <View style={styles.accRow}>
          <View style={[styles.accIcon, { backgroundColor: account.color + '22', borderColor: account.color + '44' }]}>
            <Ionicons name={iconName as any} size={22} color={account.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.accName}>{account.name}</Text>
            <Text style={styles.accType}>{account.type === 'cash' ? 'Nakit' : account.type === 'digital' ? 'Dijital' : 'Banka'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.accBalance}>{formatMoney(account.balance, account.currency, { decimals: 2 })}</Text>
            {account.currency !== displayCurrency && (
              <Text style={styles.accSub}>≈ {formatMoney(fromTry(account.balance_try), displayCurrency, { decimals: 2 })}</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.onSurfaceMuted} style={{ marginLeft: 8 }} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

function HoloCard({ card, width, onPress }: any) {
  const colors = CARD_GRADIENTS[card.gradient] || CARD_GRADIENTS.blue;
  return (
    <Pressable testID={`card-holo-${card.id}`} onPress={onPress} style={[styles.holoWrap, { width }]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(255,255,255,0.18)', 'transparent', 'rgba(0,0,0,0.4)']} style={StyleSheet.absoluteFill} />
      <View style={styles.holoContent}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={styles.holoBank}>{card.bank}</Text>
            <Text style={styles.holoName}>{card.name}</Text>
          </View>
          <Ionicons name="wifi" size={22} color="rgba(255,255,255,0.9)" style={{ transform: [{ rotate: '90deg' }] }} />
        </View>
        <View style={{ flex: 1 }} />
        <Text style={styles.holoNumber}>•••• •••• •••• {card.last4}</Text>
        <View style={styles.holoFooter}>
          <View>
            <Text style={styles.holoMicro}>LİMİT</Text>
            <Text style={styles.holoSmall}>{formatMoney(card.limit, card.currency, { decimals: 0 })}</Text>
          </View>
          <View>
            <Text style={styles.holoMicro}>BORÇ</Text>
            <Text style={styles.holoSmall}>{formatMoney(card.debt, card.currency, { decimals: 0 })}</Text>
          </View>
          <View>
            <Text style={styles.holoMicro}>KESİM</Text>
            <Text style={styles.holoSmall}>{card.statement_day}. her ay</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function CardDetailRow({ card, onPress }: any) {
  const usage = card.limit > 0 ? Math.min(100, (card.debt / card.limit) * 100) : 0;
  return (
    <Pressable testID={`card-detail-${card.id}`} onPress={onPress}>
      <GlassCard>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.accName}>{card.name}</Text>
            <Text style={styles.accType}>{card.bank} • ****{card.last4}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.accBalance, { color: theme.colors.warning }]}>{formatMoney(card.debt, card.currency, { decimals: 2 })}</Text>
            <Text style={styles.accSub}>borç</Text>
          </View>
        </View>
        {card.limit > 0 && (
          <View style={{ marginTop: 12 }}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${usage}%`, backgroundColor: usage > 80 ? theme.colors.danger : usage > 50 ? theme.colors.warning : theme.colors.success }]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={styles.accSub}>{usage.toFixed(0)}% kullanım</Text>
              <Text style={styles.accSub}>Limit: {formatMoney(card.limit, card.currency, { decimals: 0 })}</Text>
            </View>
          </View>
        )}
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 12 },
  title: { color: theme.colors.onSurface, fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' },
  segmentWrap: { flexDirection: 'row', backgroundColor: theme.colors.glass, borderRadius: theme.radius.pill, padding: 4, borderWidth: 1, borderColor: theme.colors.border },
  segment: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: theme.colors.brand },
  segmentLabel: { color: theme.colors.onSurfaceMuted, fontSize: 13, fontWeight: '700' },
  segmentLabelActive: { color: '#fff' },
  kpiLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  kpiValue: { color: theme.colors.onSurface, fontSize: 28, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 },
  kpiSub: { color: theme.colors.onSurfaceMuted, fontSize: 12, marginTop: 4 },
  accRow: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.lg },
  accIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1 },
  accName: { color: theme.colors.onSurface, fontSize: 15, fontWeight: '700' },
  accType: { color: theme.colors.onSurfaceMuted, fontSize: 12, marginTop: 2 },
  accBalance: { color: theme.colors.onSurface, fontSize: 15, fontWeight: '800' },
  accSub: { color: theme.colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  holoWrap: { height: 200, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  holoContent: { flex: 1, padding: 20, justifyContent: 'space-between' },
  holoBank: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  holoName: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 4 },
  holoNumber: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 3, marginBottom: 8 },
  holoFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  holoMicro: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  holoSmall: { color: '#fff', fontSize: 13, fontWeight: '800', marginTop: 2 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
});
