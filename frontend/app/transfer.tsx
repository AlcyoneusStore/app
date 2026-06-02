import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api';
import { theme, CurrencyCode } from '@/src/theme';

const CURS: CurrencyCode[] = ['TRY', 'USD', 'RUB'];

export default function TransferScreen() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [rates, setRates] = useState<any>({ TRY: 1, USD: 34, RUB: 0.36 });
  const [fromId, setFromId] = useState<string>('');
  const [toId, setToId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('TRY');
  const [manualConvert, setManualConvert] = useState(false);
  const [manualToAmount, setManualToAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([api.listAccounts(), api.getRates()]);
      setAccounts(a);
      setRates(r.rates);
      if (a.length >= 2) { setFromId(a[0].id); setToId(a[1].id); setCurrency(a[0].currency); }
    } catch (e) { console.warn(e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fromAcc = accounts.find(a => a.id === fromId);
  const toAcc = accounts.find(a => a.id === toId);

  const autoToAmount = useMemo(() => {
    const n = parseFloat(amount.replace(',', '.'));
    if (!n || !toAcc) return 0;
    const amountTry = n * (rates[currency] || 1);
    return amountTry / (rates[toAcc.currency] || 1);
  }, [amount, currency, toAcc, rates]);

  const save = async () => {
    const n = parseFloat(amount.replace(',', '.'));
    if (!n || !fromAcc || !toAcc || fromId === toId) return;
    setSaving(true);
    try {
      await api.createTransfer({
        from_account_id: fromId,
        to_account_id: toId,
        amount: n,
        currency,
        to_amount: manualConvert && manualToAmount ? parseFloat(manualToAmount.replace(',', '.')) : undefined,
        note,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) { console.warn(e); } finally { setSaving(false); }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0A0E27', '#050816']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable testID="transfer-close" onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.title}>Hesaplar Arası Transfer</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Kaynak Hesap</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {accounts.map(a => (
                <Pressable key={a.id} testID={`from-${a.id}`} onPress={() => { Haptics.selectionAsync(); setFromId(a.id); setCurrency(a.currency); }} style={[styles.accChip, fromId === a.id && { backgroundColor: theme.colors.brandTint, borderColor: theme.colors.brand }]}>
                  <Text style={[styles.accChipName, fromId === a.id && { color: theme.colors.brand }]}>{a.name}</Text>
                  <Text style={styles.accChipBal}>{a.balance.toFixed(2)} {a.currency}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Hedef Hesap</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {accounts.filter(a => a.id !== fromId).map(a => (
                <Pressable key={a.id} testID={`to-${a.id}`} onPress={() => { Haptics.selectionAsync(); setToId(a.id); }} style={[styles.accChip, toId === a.id && { backgroundColor: theme.colors.successDim, borderColor: theme.colors.success }]}>
                  <Text style={[styles.accChipName, toId === a.id && { color: theme.colors.success }]}>{a.name}</Text>
                  <Text style={styles.accChipBal}>{a.balance.toFixed(2)} {a.currency}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Tutar</Text>
            <View style={styles.amountWrap}>
              <Text style={styles.amountSymbol}>{currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : '₽'}</Text>
              <TextInput
                testID="transfer-amount"
                placeholder="0.00"
                placeholderTextColor={theme.colors.onSurfaceDim}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                style={styles.amountInput}
              />
            </View>

            <Text style={styles.fieldLabel}>Para Birimi</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {CURS.map(c => (
                <Pressable key={c} testID={`tr-cur-${c}`} onPress={() => { Haptics.selectionAsync(); setCurrency(c); }} style={[styles.curBtn, currency === c && styles.curActive]}>
                  <Text style={[styles.curLabel, currency === c && { color: '#fff' }]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            {fromAcc && toAcc && fromAcc.currency !== toAcc.currency && (
              <View style={styles.convertCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={styles.convertLabel}>Otomatik dönüşüm</Text>
                    <Text style={styles.convertValue}>≈ {autoToAmount.toFixed(2)} {toAcc.currency}</Text>
                  </View>
                  <Pressable testID="toggle-manual" onPress={() => { Haptics.selectionAsync(); setManualConvert(v => !v); }} style={[styles.switchTrack, manualConvert && styles.switchTrackOn]}>
                    <View style={[styles.switchThumb, manualConvert && styles.switchThumbOn]} />
                  </Pressable>
                </View>
                {manualConvert && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.fieldLabel}>Manuel hedef tutar ({toAcc.currency})</Text>
                    <TextInput
                      testID="manual-to-amount"
                      placeholder={`örn. ${autoToAmount.toFixed(2)}`}
                      placeholderTextColor={theme.colors.onSurfaceDim}
                      value={manualToAmount}
                      onChangeText={setManualToAmount}
                      keyboardType="decimal-pad"
                      style={styles.input}
                    />
                  </View>
                )}
              </View>
            )}

            <Text style={styles.fieldLabel}>Not (opsiyonel)</Text>
            <TextInput
              testID="transfer-note"
              placeholder="Transfer açıklaması"
              placeholderTextColor={theme.colors.onSurfaceDim}
              value={note}
              onChangeText={setNote}
              style={styles.input}
            />

            <Pressable testID="transfer-save" disabled={saving || !amount || fromId === toId} onPress={save} style={[styles.saveBtn, (saving || !amount || fromId === toId) && { opacity: 0.5 }]}>
              <Ionicons name="swap-horizontal" size={18} color="#fff" />
              <Text style={styles.saveText}>{saving ? 'Aktarılıyor...' : 'Transfer Et'}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  title: { color: theme.colors.onSurface, fontSize: 17, fontWeight: '800' },
  fieldLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  accChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, minWidth: 140 },
  accChipName: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '700' },
  accChipBal: { color: theme.colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, paddingHorizontal: 16, height: 60 },
  amountSymbol: { color: theme.colors.brand, fontSize: 28, fontWeight: '800', marginRight: 8 },
  amountInput: { flex: 1, color: theme.colors.onSurface, fontSize: 28, fontWeight: '800' },
  curBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  curActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  curLabel: { color: theme.colors.onSurfaceMuted, fontSize: 14, fontWeight: '700' },
  convertCard: { backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 14, marginTop: 16 },
  convertLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  convertValue: { color: theme.colors.success, fontSize: 18, fontWeight: '800', marginTop: 4 },
  switchTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: theme.colors.surfaceTertiary, padding: 2 },
  switchTrackOn: { backgroundColor: theme.colors.brand },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  switchThumbOn: { transform: [{ translateX: 18 }] },
  input: { backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, color: theme.colors.onSurface, fontSize: 15 },
  saveBtn: { marginTop: 24, paddingVertical: 16, borderRadius: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.brand },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
