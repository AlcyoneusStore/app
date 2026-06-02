import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api';
import { theme, CurrencyCode } from '@/src/theme';

const CURS: CurrencyCode[] = ['TRY', 'USD', 'RUB'];
const GRADIENTS = ['blue', 'purple', 'holo1', 'holo2'];
const CARD_GRADIENTS: Record<string, string[]> = {
  blue: ['#0066FF', '#00C2FF'],
  purple: ['#7928CA', '#FF0080'],
  holo1: ['#0090FF', '#9F7AEA'],
  holo2: ['#FF3366', '#FFB800'],
};

export default function EditCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; payload?: string }>();
  const isEdit = !!params.id;
  const initial = params.payload ? JSON.parse(decodeURIComponent(params.payload as string)) : null;

  const [name, setName] = useState(initial?.name || '');
  const [bank, setBank] = useState(initial?.bank || '');
  const [last4, setLast4] = useState(initial?.last4 || '');
  const [currency, setCurrency] = useState<CurrencyCode>(initial?.currency || 'TRY');
  const [cardType, setCardType] = useState(initial?.card_type || 'credit');
  const [limit, setLimit] = useState(initial?.limit != null ? String(initial.limit) : '');
  const [debt, setDebt] = useState(initial?.debt != null ? String(initial.debt) : '');
  const [statementDay, setStatementDay] = useState(initial?.statement_day != null ? String(initial.statement_day) : '1');
  const [dueDay, setDueDay] = useState(initial?.due_day != null ? String(initial.due_day) : '1');
  const [gradient, setGradient] = useState(initial?.gradient || 'blue');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !bank.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: name.trim(), bank: bank.trim(), last4: last4.slice(0, 4),
        currency, card_type: cardType,
        limit: parseFloat(limit.replace(',', '.')) || 0,
        debt: parseFloat(debt.replace(',', '.')) || 0,
        statement_day: parseInt(statementDay) || 1,
        due_day: parseInt(dueDay) || 1,
        gradient,
      };
      if (isEdit) await api.updateCard(params.id as string, data);
      else await api.createCard(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) { console.warn(e); } finally { setSaving(false); }
  };

  const del = async () => {
    if (!params.id) return;
    setSaving(true);
    try {
      await api.deleteCard(params.id as string);
      router.back();
    } catch (e) { console.warn(e); } finally { setSaving(false); }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0A0E27', '#050816']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable testID="ec-close" onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.title}>{isEdit ? 'Kartı Düzenle' : 'Yeni Kart'}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Kart Adı</Text>
            <TextInput testID="ec-name" placeholder="Bonus Platinum" placeholderTextColor={theme.colors.onSurfaceDim} value={name} onChangeText={setName} style={styles.input} />

            <Text style={styles.fieldLabel}>Banka</Text>
            <TextInput testID="ec-bank" placeholder="Garanti BBVA" placeholderTextColor={theme.colors.onSurfaceDim} value={bank} onChangeText={setBank} style={styles.input} />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Son 4 Hane</Text>
                <TextInput testID="ec-last4" placeholder="1234" maxLength={4} placeholderTextColor={theme.colors.onSurfaceDim} value={last4} onChangeText={setLast4} keyboardType="number-pad" style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Para Birimi</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {CURS.map(c => (
                    <Pressable key={c} onPress={() => setCurrency(c)} style={[styles.curBtn, currency === c && styles.curActive]}>
                      <Text style={[styles.curLabel, currency === c && { color: '#fff' }]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Text style={styles.fieldLabel}>Kart Türü</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['credit', 'debit'].map(t => (
                <Pressable key={t} onPress={() => setCardType(t)} style={[styles.curBtn, cardType === t && styles.curActive]}>
                  <Text style={[styles.curLabel, cardType === t && { color: '#fff' }]}>{t === 'credit' ? 'Kredi' : 'Banka'}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Limit</Text>
                <TextInput testID="ec-limit" placeholder="0" placeholderTextColor={theme.colors.onSurfaceDim} value={limit} onChangeText={setLimit} keyboardType="decimal-pad" style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Güncel Borç</Text>
                <TextInput testID="ec-debt" placeholder="0" placeholderTextColor={theme.colors.onSurfaceDim} value={debt} onChangeText={setDebt} keyboardType="decimal-pad" style={styles.input} />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Hesap Kesim Günü</Text>
                <TextInput testID="ec-statement" placeholder="15" placeholderTextColor={theme.colors.onSurfaceDim} value={statementDay} onChangeText={setStatementDay} keyboardType="number-pad" style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Son Ödeme Günü</Text>
                <TextInput testID="ec-due" placeholder="25" placeholderTextColor={theme.colors.onSurfaceDim} value={dueDay} onChangeText={setDueDay} keyboardType="number-pad" style={styles.input} />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Kart Görünümü</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {GRADIENTS.map(g => (
                <Pressable key={g} onPress={() => setGradient(g)} style={[styles.gradPick, gradient === g && { borderColor: '#fff' }]}>
                  <LinearGradient colors={CARD_GRADIENTS[g] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
              {isEdit && (
                <Pressable testID="ec-delete" disabled={saving} onPress={del} style={[styles.btn, { backgroundColor: theme.colors.dangerDim, borderWidth: 1, borderColor: theme.colors.danger, paddingHorizontal: 18 }]}>
                  <Ionicons name="trash" size={18} color={theme.colors.danger} />
                </Pressable>
              )}
              <Pressable testID="ec-save" disabled={saving} onPress={save} style={[styles.btn, { flex: 1, backgroundColor: theme.colors.brand }]}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
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
  fieldLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, color: theme.colors.onSurface, fontSize: 15 },
  curBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  curActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  curLabel: { color: theme.colors.onSurfaceMuted, fontSize: 13, fontWeight: '700' },
  gradPick: { flex: 1, height: 56, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  btn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
