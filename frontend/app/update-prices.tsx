import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api';
import { theme } from '@/src/theme';

export default function UpdatePricesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await api.listInvestments();
    setItems(data);
    const e: Record<string, string> = {};
    data.forEach((i: any) => { e[i.id] = String(i.current_price); });
    setEdits(e);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const updates = items
        .map(i => ({ id: i.id, current_price: parseFloat((edits[i.id] || '').replace(',', '.')) }))
        .filter(u => !isNaN(u.current_price) && u.current_price >= 0);
      if (!updates.length) return;
      await api.bulkUpdateInvestments(updates);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setSaving(false); }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0A0E27', '#050816']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable testID="up-close" onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.title}>Güncel Değerleri Güncelle</Text>
            <View style={{ width: 40 }} />
          </View>

          <Text style={styles.subtitle}>Her varlık için güncel birim fiyatını gir. Sistem, miktar × fiyat üzerinden değeri otomatik hesaplar.</Text>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
            {items.map(inv => {
              const cost = inv.cost_basis * inv.quantity;
              const newPrice = parseFloat((edits[inv.id] || '').replace(',', '.')) || inv.current_price;
              const newValue = newPrice * inv.quantity;
              const pl = newValue - cost;
              const positive = pl >= 0;
              return (
                <View key={inv.id} style={styles.row}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <View>
                      <Text style={styles.invName}>{inv.name}</Text>
                      <Text style={styles.invMeta}>{inv.quantity} {inv.symbol} · Maliyet birim: {inv.cost_basis} {inv.currency}</Text>
                    </View>
                    <Text style={[styles.plPct, { color: positive ? theme.colors.success : theme.colors.danger }]}>
                      {positive ? '▲' : '▼'} {(cost > 0 ? (pl / cost) * 100 : 0).toFixed(2)}%
                    </Text>
                  </View>
                  <View style={styles.inputWrap}>
                    <Text style={styles.curLabel}>{inv.currency === 'TRY' ? '₺' : inv.currency === 'USD' ? '$' : '₽'}</Text>
                    <TextInput
                      testID={`price-${inv.id}`}
                      value={edits[inv.id] ?? ''}
                      onChangeText={(v) => setEdits(s => ({ ...s, [inv.id]: v }))}
                      keyboardType="decimal-pad"
                      placeholder="Güncel birim fiyat"
                      placeholderTextColor={theme.colors.onSurfaceDim}
                      style={styles.input}
                    />
                    <Text style={styles.totalLabel}>= {newValue.toFixed(2)} {inv.currency}</Text>
                  </View>
                </View>
              );
            })}
            {items.length === 0 && (
              <Text style={{ color: theme.colors.onSurfaceMuted, textAlign: 'center', marginTop: 40 }}>Henüz yatırım yok</Text>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable testID="up-save" disabled={saving || !items.length} onPress={save} style={[styles.btn, (saving || !items.length) && { opacity: 0.5 }]}>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.btnText}>{saving ? 'Kaydediliyor...' : 'Hepsini Kaydet'}</Text>
            </Pressable>
          </View>
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
  subtitle: { color: theme.colors.onSurfaceMuted, fontSize: 13, paddingHorizontal: 24, marginTop: 4, marginBottom: 8, lineHeight: 18 },
  row: { backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, padding: 16, marginBottom: 12 },
  invName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  invMeta: { color: theme.colors.onSurfaceMuted, fontSize: 11, marginTop: 2 },
  plPct: { fontSize: 13, fontWeight: '800' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: theme.colors.border },
  curLabel: { color: theme.colors.brand, fontSize: 18, fontWeight: '800' },
  input: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700', paddingVertical: 10 },
  totalLabel: { color: theme.colors.success, fontSize: 12, fontWeight: '700' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(5,8,22,0.95)', borderTopWidth: 1, borderTopColor: theme.colors.border },
  btn: { flexDirection: 'row', gap: 8, height: 52, borderRadius: 14, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});
