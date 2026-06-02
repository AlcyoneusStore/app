import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api';
import { theme, CATEGORIES, CurrencyCode } from '@/src/theme';

const TYPES = ['expense', 'income'] as const;
const CURS: CurrencyCode[] = ['TRY', 'USD', 'RUB'];

export default function AddTransactionScreen() {
  const router = useRouter();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('TRY');
  const [category, setCategory] = useState('Market');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const incomeCats = ['Maaş', 'Freelance', 'Diğer'];
  const expenseCats = CATEGORIES.filter(c => !incomeCats.includes(c.id) || c.id === 'Diğer').map(c => c.id);
  const availableCats = type === 'income' ? incomeCats : expenseCats;

  const save = async () => {
    const n = parseFloat(amount.replace(',', '.'));
    if (!n || n <= 0) return;
    setSaving(true);
    try {
      await api.createTransaction({ type, amount: n, currency, category, note });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      console.warn(e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
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
            <Text style={styles.title}>Yeni İşlem</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
            {/* Type toggle */}
            <View style={styles.typeWrap}>
              {TYPES.map(t => (
                <Pressable
                  key={t}
                  testID={`type-${t}`}
                  onPress={() => { Haptics.selectionAsync(); setType(t); setCategory(t === 'income' ? 'Maaş' : 'Market'); }}
                  style={[styles.typeBtn, type === t && (t === 'expense' ? styles.typeActiveExp : styles.typeActiveInc)]}
                >
                  <Ionicons name={t === 'expense' ? 'arrow-down' : 'arrow-up'} size={16} color={type === t ? '#fff' : theme.colors.onSurfaceMuted} />
                  <Text style={[styles.typeLabel, type === t && { color: '#fff' }]}>
                    {t === 'expense' ? 'Gider' : 'Gelir'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Amount */}
            <Text style={styles.fieldLabel}>Tutar</Text>
            <View style={styles.amountWrap}>
              <Text style={styles.amountSymbol}>
                {currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : '₽'}
              </Text>
              <TextInput
                testID="amount-input"
                placeholder="0.00"
                placeholderTextColor={theme.colors.onSurfaceDim}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                style={styles.amountInput}
              />
            </View>

            {/* Currency */}
            <Text style={styles.fieldLabel}>Para Birimi</Text>
            <View style={styles.curRow}>
              {CURS.map(c => (
                <Pressable
                  key={c}
                  testID={`cur-${c}`}
                  onPress={() => { Haptics.selectionAsync(); setCurrency(c); }}
                  style={[styles.curBtn, currency === c && styles.curActive]}
                >
                  <Text style={[styles.curLabel, currency === c && { color: '#fff' }]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            {/* Category */}
            <Text style={styles.fieldLabel}>Kategori</Text>
            <View style={styles.catGrid}>
              {availableCats.map(c => {
                const def = CATEGORIES.find(x => x.id === c);
                const active = category === c;
                return (
                  <Pressable
                    key={c}
                    testID={`cat-${c}`}
                    onPress={() => { Haptics.selectionAsync(); setCategory(c); }}
                    style={[styles.catBtn, active && { backgroundColor: (def?.color || theme.colors.brand) + '22', borderColor: def?.color || theme.colors.brand }]}
                  >
                    <Ionicons name={(def?.icon as any) || 'ellipsis-horizontal'} size={16} color={def?.color || theme.colors.brand} />
                    <Text style={[styles.catText, active && { color: '#fff' }]}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Note */}
            <Text style={styles.fieldLabel}>Not (opsiyonel)</Text>
            <TextInput
              testID="note-input"
              placeholder="örn. Migros haftalık alışveriş"
              placeholderTextColor={theme.colors.onSurfaceDim}
              value={note}
              onChangeText={setNote}
              style={styles.noteInput}
            />

            <Pressable
              testID="save-tx-btn"
              disabled={saving}
              onPress={save}
              style={[styles.saveBtn, { backgroundColor: type === 'expense' ? theme.colors.danger : theme.colors.success }]}
            >
              <Text style={[styles.saveText, { color: type === 'income' ? theme.colors.surface : '#fff' }]}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </Text>
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
  title: { color: theme.colors.onSurface, fontSize: 18, fontWeight: '800' },
  typeWrap: { flexDirection: 'row', backgroundColor: theme.colors.glass, borderRadius: theme.radius.pill, padding: 4, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 24 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: theme.radius.pill },
  typeActiveExp: { backgroundColor: theme.colors.danger },
  typeActiveInc: { backgroundColor: theme.colors.success },
  typeLabel: { color: theme.colors.onSurfaceMuted, fontSize: 14, fontWeight: '700' },
  fieldLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, paddingHorizontal: 16, height: 64 },
  amountSymbol: { color: theme.colors.brand, fontSize: 32, fontWeight: '800', marginRight: 8 },
  amountInput: { flex: 1, color: theme.colors.onSurface, fontSize: 32, fontWeight: '800' },
  curRow: { flexDirection: 'row', gap: 8 },
  curBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  curActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  curLabel: { color: theme.colors.onSurfaceMuted, fontSize: 14, fontWeight: '700' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  catText: { color: theme.colors.onSurfaceMuted, fontSize: 13, fontWeight: '600' },
  noteInput: { backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, color: theme.colors.onSurface, fontSize: 14 },
  saveBtn: { marginTop: 24, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  saveText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
