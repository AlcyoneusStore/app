import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api';
import { theme, CurrencyCode } from '@/src/theme';

const TYPES = [
  { id: 'bank', label: 'Banka', icon: 'business' },
  { id: 'cash', label: 'Nakit', icon: 'cash' },
  { id: 'digital', label: 'Dijital', icon: 'phone-portrait' },
];
const CURS: CurrencyCode[] = ['TRY', 'USD', 'RUB'];
const COLORS = ['#00FF94', '#FF3366', '#FFB800', '#0090FF', '#9F7AEA', '#FF6B35', '#0066FF', '#FFD700'];

export default function EditAccountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; payload?: string }>();
  const isEdit = !!params.id;

  const initial = params.payload ? JSON.parse(decodeURIComponent(params.payload as string)) : null;
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || 'bank');
  const [currency, setCurrency] = useState<CurrencyCode>(initial?.currency || 'TRY');
  const [balance, setBalance] = useState(initial?.balance != null ? String(initial.balance) : '');
  const [color, setColor] = useState(initial?.color || '#0066FF');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // already initialized from params
  }, []);

  const save = async () => {
    const b = parseFloat(balance.replace(',', '.'));
    if (!name.trim() || isNaN(b)) return;
    setSaving(true);
    try {
      const data = { name: name.trim(), type, currency, balance: b, color };
      if (isEdit) await api.updateAccount(params.id as string, data);
      else await api.createAccount(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) { console.warn(e); } finally { setSaving(false); }
  };

  const del = async () => {
    if (!params.id) return;
    setSaving(true);
    try {
      await api.deleteAccount(params.id as string);
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
            <Pressable testID="ea-close" onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.title}>{isEdit ? 'Hesabı Düzenle' : 'Yeni Hesap'}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Hesap Adı</Text>
            <TextInput testID="ea-name" placeholder="örn. Garanti Vadesiz" placeholderTextColor={theme.colors.onSurfaceDim} value={name} onChangeText={setName} style={styles.input} />

            <Text style={styles.fieldLabel}>Tip</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {TYPES.map(t => (
                <Pressable key={t.id} testID={`ea-type-${t.id}`} onPress={() => { Haptics.selectionAsync(); setType(t.id); }} style={[styles.typeBtn, type === t.id && { backgroundColor: theme.colors.brandTint, borderColor: theme.colors.brand }]}>
                  <Ionicons name={t.icon as any} size={20} color={type === t.id ? theme.colors.brand : theme.colors.onSurfaceMuted} />
                  <Text style={[styles.typeLabel, type === t.id && { color: theme.colors.brand }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Para Birimi</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {CURS.map(c => (
                <Pressable key={c} testID={`ea-cur-${c}`} onPress={() => { Haptics.selectionAsync(); setCurrency(c); }} style={[styles.curBtn, currency === c && styles.curActive]}>
                  <Text style={[styles.curLabel, currency === c && { color: '#fff' }]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Bakiye</Text>
            <TextInput testID="ea-balance" placeholder="0.00" placeholderTextColor={theme.colors.onSurfaceDim} value={balance} onChangeText={setBalance} keyboardType="decimal-pad" style={styles.input} />

            <Text style={styles.fieldLabel}>Renk</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <Pressable key={c} onPress={() => setColor(c)} style={[styles.colorPick, { backgroundColor: c }, color === c && styles.colorPickActive]} />
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
              {isEdit && (
                <Pressable testID="ea-delete" disabled={saving} onPress={del} style={[styles.btn, { backgroundColor: theme.colors.dangerDim, borderWidth: 1, borderColor: theme.colors.danger, paddingHorizontal: 18 }]}>
                  <Ionicons name="trash" size={18} color={theme.colors.danger} />
                </Pressable>
              )}
              <Pressable testID="ea-save" disabled={saving} onPress={save} style={[styles.btn, { flex: 1, backgroundColor: theme.colors.brand }]}>
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
  typeBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  typeLabel: { color: theme.colors.onSurfaceMuted, fontSize: 12, fontWeight: '700' },
  curBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  curActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  curLabel: { color: theme.colors.onSurfaceMuted, fontSize: 14, fontWeight: '700' },
  colorPick: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorPickActive: { borderColor: '#fff' },
  btn: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
