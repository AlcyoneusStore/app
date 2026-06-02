import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api';
import { theme, CurrencyCode } from '@/src/theme';

const TYPES = [
  { id: 'expense', label: 'Gider', icon: 'arrow-down', color: '#FF3366' },
  { id: 'income', label: 'Gelir', icon: 'arrow-up', color: '#00FF94' },
  { id: 'card_payment', label: 'Kart Ödeme', icon: 'card', color: '#0090FF' },
] as const;

const CURS: CurrencyCode[] = ['TRY', 'USD', 'RUB'];

export default function AddTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; payload?: string }>();
  const isEdit = !!params.id;
  const initial = params.payload ? JSON.parse(decodeURIComponent(params.payload as string)) : null;

  const [type, setType] = useState<'expense' | 'income' | 'card_payment'>(initial?.type || 'expense');
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
  const [currency, setCurrency] = useState<CurrencyCode>(initial?.currency || 'TRY');
  const [category, setCategory] = useState(initial?.category || '');
  const [note, setNote] = useState(initial?.note || '');
  const [sourceType, setSourceType] = useState<'account' | 'card'>(initial?.source_type || 'account');
  const [accountId, setAccountId] = useState<string>(initial?.account_id || '');
  const [cardId, setCardId] = useState<string>(initial?.card_id || '');
  const [saving, setSaving] = useState(false);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [showAllCats, setShowAllCats] = useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const [a, c, cats] = await Promise.all([api.listAccounts(), api.listCards(), api.listCategories()]);
        setAccounts(a); setCards(c); setCategories(cats);
        if (!isEdit) {
          if (a.length && !accountId) setAccountId(a[0].id);
          if (c.length && !cardId) setCardId(c[0].id);
          if (!category) {
            const first = cats.find((x: any) => x.kind === (type === 'income' ? 'income' : 'expense'));
            if (first) setCategory(first.name);
          }
        }
      } catch (e) { console.warn(e); }
    })();
  }, []);

  const availableCats = categories.filter(c =>
    type === 'income' ? c.kind === 'income' : type === 'card_payment' ? c.name === 'Diğer Gider' || true : c.kind === 'expense'
  );

  const save = async () => {
    const n = parseFloat(amount.replace(',', '.'));
    if (!n || n <= 0) return;
    setSaving(true);
    try {
      const payload: any = {
        type,
        amount: n,
        currency,
        category: type === 'card_payment' ? 'Kart Ödemesi' : category,
        note,
      };
      if (type === 'expense') {
        payload.source_type = sourceType;
        if (sourceType === 'account') payload.account_id = accountId;
        else payload.card_id = cardId;
      } else if (type === 'income') {
        payload.source_type = 'account';
        payload.account_id = accountId;
      } else if (type === 'card_payment') {
        payload.source_type = 'account';
        payload.account_id = accountId;
        payload.card_id = cardId;
      }

      if (isEdit) {
        await api.updateTransaction(params.id as string, { amount: n, currency, category: payload.category, note });
      } else {
        await api.createTransaction(payload);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) { console.warn(e); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!params.id) return;
    setSaving(true);
    try {
      await api.deleteTransaction(params.id as string);
      router.back();
    } catch (e) { console.warn(e); } finally { setSaving(false); }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0A0E27', '#050816']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable testID="close-modal" onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.title}>{isEdit ? 'İşlemi Düzenle' : 'Yeni İşlem'}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
            {/* Type */}
            <View style={styles.typeWrap}>
              {TYPES.map(t => (
                <Pressable
                  key={t.id}
                  testID={`type-${t.id}`}
                  onPress={() => { Haptics.selectionAsync(); setType(t.id); }}
                  style={[styles.typeBtn, type === t.id && { backgroundColor: t.color }]}
                >
                  <Ionicons name={t.icon as any} size={14} color={type === t.id ? '#fff' : theme.colors.onSurfaceMuted} />
                  <Text style={[styles.typeLabel, type === t.id && { color: '#fff' }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Amount */}
            <Text style={styles.fieldLabel}>Tutar</Text>
            <View style={styles.amountWrap}>
              <Text style={styles.amountSymbol}>{currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : '₽'}</Text>
              <TextInput testID="amount-input" placeholder="0.00" placeholderTextColor={theme.colors.onSurfaceDim} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={styles.amountInput} />
            </View>

            <Text style={styles.fieldLabel}>Para Birimi</Text>
            <View style={styles.curRow}>
              {CURS.map(c => (
                <Pressable key={c} testID={`cur-${c}`} onPress={() => { Haptics.selectionAsync(); setCurrency(c); }} style={[styles.curBtn, currency === c && styles.curActive]}>
                  <Text style={[styles.curLabel, currency === c && { color: '#fff' }]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            {/* Source */}
            {!isEdit && (
              <>
                {type === 'expense' && (
                  <>
                    <Text style={styles.fieldLabel}>Ödeme Kaynağı</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable testID="src-account" onPress={() => { Haptics.selectionAsync(); setSourceType('account'); }} style={[styles.srcBtn, sourceType === 'account' && styles.srcActive]}>
                        <Ionicons name="wallet" size={16} color={sourceType === 'account' ? '#fff' : theme.colors.onSurfaceMuted} />
                        <Text style={[styles.srcText, sourceType === 'account' && { color: '#fff' }]}>Hesap/Nakit</Text>
                      </Pressable>
                      <Pressable testID="src-card" onPress={() => { Haptics.selectionAsync(); setSourceType('card'); }} style={[styles.srcBtn, sourceType === 'card' && styles.srcActive]}>
                        <Ionicons name="card" size={16} color={sourceType === 'card' ? '#fff' : theme.colors.onSurfaceMuted} />
                        <Text style={[styles.srcText, sourceType === 'card' && { color: '#fff' }]}>Kredi Kartı</Text>
                      </Pressable>
                    </View>
                  </>
                )}

                {(type === 'expense' && sourceType === 'account') || type === 'income' || type === 'card_payment' ? (
                  <>
                    <Text style={styles.fieldLabel}>{type === 'income' ? 'Gelir Hesabı' : 'Kaynak Hesap'}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                      {accounts.map(a => (
                        <Pressable key={a.id} testID={`acc-${a.id}`} onPress={() => { Haptics.selectionAsync(); setAccountId(a.id); }} style={[styles.pickChip, accountId === a.id && { backgroundColor: theme.colors.brandTint, borderColor: theme.colors.brand }]}>
                          <Text style={[styles.pickName, accountId === a.id && { color: theme.colors.brand }]}>{a.name}</Text>
                          <Text style={styles.pickBal}>{a.balance.toFixed(0)} {a.currency}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                ) : null}

                {(type === 'expense' && sourceType === 'card') || type === 'card_payment' ? (
                  <>
                    <Text style={styles.fieldLabel}>{type === 'card_payment' ? 'Ödenen Kart' : 'Kart'}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                      {cards.filter(c => type === 'card_payment' ? true : c.card_type === 'credit').map(c => (
                        <Pressable key={c.id} testID={`card-${c.id}`} onPress={() => { Haptics.selectionAsync(); setCardId(c.id); }} style={[styles.pickChip, cardId === c.id && { backgroundColor: theme.colors.brandTint, borderColor: theme.colors.brand }]}>
                          <Text style={[styles.pickName, cardId === c.id && { color: theme.colors.brand }]}>{c.name}</Text>
                          <Text style={styles.pickBal}>Borç: {c.debt.toFixed(0)} {c.currency}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                ) : null}
              </>
            )}

            {/* Category */}
            {type !== 'card_payment' && (
              <>
                <Text style={styles.fieldLabel}>Kategori</Text>
                <View style={styles.catGrid}>
                  {availableCats.slice(0, showAllCats ? 100 : 8).map(c => {
                    const active = category === c.name;
                    return (
                      <Pressable key={c.id} testID={`cat-${c.name}`} onPress={() => { Haptics.selectionAsync(); setCategory(c.name); }} style={[styles.catBtn, active && { backgroundColor: c.color + '22', borderColor: c.color }]}>
                        <Ionicons name={c.icon as any} size={16} color={c.color} />
                        <Text style={[styles.catText, active && { color: '#fff' }]}>{c.name}</Text>
                      </Pressable>
                    );
                  })}
                  {!showAllCats && availableCats.length > 8 && (
                    <Pressable onPress={() => setShowAllCats(true)} style={styles.catBtn}>
                      <Ionicons name="add" size={14} color={theme.colors.onSurfaceMuted} />
                      <Text style={styles.catText}>+{availableCats.length - 8} daha</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>Not (opsiyonel)</Text>
            <TextInput testID="note-input" placeholder="örn. Migros haftalık alışveriş" placeholderTextColor={theme.colors.onSurfaceDim} value={note} onChangeText={setNote} style={styles.noteInput} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
              {isEdit && (
                <Pressable testID="tx-delete" disabled={saving} onPress={del} style={[styles.btn, { backgroundColor: theme.colors.dangerDim, borderWidth: 1, borderColor: theme.colors.danger, paddingHorizontal: 18 }]}>
                  <Ionicons name="trash" size={18} color={theme.colors.danger} />
                </Pressable>
              )}
              <Pressable testID="save-tx-btn" disabled={saving} onPress={save} style={[styles.btn, { flex: 1, backgroundColor: type === 'expense' ? theme.colors.danger : type === 'card_payment' ? theme.colors.brand : theme.colors.success }]}>
                <Text style={[styles.saveText, { color: type === 'income' ? theme.colors.surface : '#fff' }]}>{saving ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Kaydet'}</Text>
              </Pressable>
            </View>
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
  typeWrap: { flexDirection: 'row', backgroundColor: theme.colors.glass, borderRadius: theme.radius.pill, padding: 4, borderWidth: 1, borderColor: theme.colors.border, gap: 4 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: theme.radius.pill },
  typeLabel: { color: theme.colors.onSurfaceMuted, fontSize: 12, fontWeight: '700' },
  fieldLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, paddingHorizontal: 16, height: 60 },
  amountSymbol: { color: theme.colors.brand, fontSize: 28, fontWeight: '800', marginRight: 8 },
  amountInput: { flex: 1, color: theme.colors.onSurface, fontSize: 28, fontWeight: '800' },
  curRow: { flexDirection: 'row', gap: 8 },
  curBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  curActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  curLabel: { color: theme.colors.onSurfaceMuted, fontSize: 14, fontWeight: '700' },
  srcBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  srcActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  srcText: { color: theme.colors.onSurfaceMuted, fontSize: 13, fontWeight: '700' },
  pickChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, minWidth: 120 },
  pickName: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '700' },
  pickBal: { color: theme.colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  catText: { color: theme.colors.onSurfaceMuted, fontSize: 13, fontWeight: '600' },
  noteInput: { backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, color: theme.colors.onSurface, fontSize: 14 },
  btn: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
