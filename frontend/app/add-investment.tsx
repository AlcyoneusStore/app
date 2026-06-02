import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api';
import { theme, CurrencyCode } from '@/src/theme';

const TYPES = [
  { id: 'stock', label: 'Hisse', icon: 'trending-up', color: '#0090FF' },
  { id: 'crypto', label: 'Kripto', icon: 'logo-bitcoin', color: '#FFB800' },
  { id: 'gold', label: 'Altın', icon: 'star', color: '#FFD700' },
  { id: 'fund', label: 'Fon', icon: 'pie-chart', color: '#9F7AEA' },
] as const;
const CURS: CurrencyCode[] = ['TRY', 'USD', 'RUB'];

export default function AddInvestmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; payload?: string }>();
  const isEdit = !!params.id;
  const initial = params.payload ? JSON.parse(decodeURIComponent(params.payload as string)) : null;

  const [assetType, setAssetType] = useState<string>(initial?.asset_type || 'stock');
  const [symbol, setSymbol] = useState(initial?.symbol || '');
  const [name, setName] = useState(initial?.name || '');
  const [quantity, setQuantity] = useState(initial?.quantity != null ? String(initial.quantity) : '');
  const [costBasis, setCostBasis] = useState(initial?.cost_basis != null ? String(initial.cost_basis) : '');
  const [currentPrice, setCurrentPrice] = useState(initial?.current_price != null ? String(initial.current_price) : '');
  const [currency, setCurrency] = useState<CurrencyCode>(initial?.currency || 'TRY');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const q = parseFloat(quantity.replace(',', '.'));
    const cb = parseFloat(costBasis.replace(',', '.'));
    const cp = parseFloat(currentPrice.replace(',', '.'));
    if (!symbol.trim() || !q || !cb || !cp) return;
    setSaving(true);
    try {
      const data = {
        symbol: symbol.toUpperCase(),
        name: name || symbol.toUpperCase(),
        asset_type: assetType,
        quantity: q,
        cost_basis: cb,
        current_price: cp,
        currency,
      };
      if (isEdit) await api.updateInvestment(params.id as string, data);
      else await api.createInvestment(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      console.warn(e);
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!params.id) return;
    setSaving(true);
    try {
      await api.deleteInvestment(params.id as string);
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
            <Text style={styles.title}>{isEdit ? 'Yatırımı Düzenle' : 'Yeni Yatırım'}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Varlık Tipi</Text>
            <View style={styles.typeGrid}>
              {TYPES.map(t => {
                const active = assetType === t.id;
                return (
                  <Pressable
                    key={t.id}
                    testID={`asset-type-${t.id}`}
                    onPress={() => { Haptics.selectionAsync(); setAssetType(t.id); }}
                    style={[styles.typeBtn, active && { backgroundColor: t.color + '22', borderColor: t.color }]}
                  >
                    <Ionicons name={t.icon as any} size={20} color={active ? t.color : theme.colors.onSurfaceMuted} />
                    <Text style={[styles.typeLabel, active && { color: '#fff' }]}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Sembol</Text>
            <TextInput
              testID="inv-symbol"
              placeholder="BTC, AAPL, ASELS..."
              placeholderTextColor={theme.colors.onSurfaceDim}
              value={symbol}
              autoCapitalize="characters"
              onChangeText={setSymbol}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>İsim</Text>
            <TextInput
              testID="inv-name"
              placeholder="Bitcoin, Apple Inc..."
              placeholderTextColor={theme.colors.onSurfaceDim}
              value={name}
              onChangeText={setName}
              style={styles.input}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Miktar</Text>
                <TextInput
                  testID="inv-quantity"
                  placeholder="0"
                  placeholderTextColor={theme.colors.onSurfaceDim}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Para Birimi</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {CURS.map(c => (
                    <Pressable
                      key={c}
                      testID={`inv-cur-${c}`}
                      onPress={() => { Haptics.selectionAsync(); setCurrency(c); }}
                      style={[styles.curBtn, currency === c && styles.curActive]}
                    >
                      <Text style={[styles.curLabel, currency === c && { color: '#fff' }]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Maliyet (Birim)</Text>
                <TextInput
                  testID="inv-cost"
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.onSurfaceDim}
                  value={costBasis}
                  onChangeText={setCostBasis}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Güncel Fiyat</Text>
                <TextInput
                  testID="inv-price"
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.onSurfaceDim}
                  value={currentPrice}
                  onChangeText={setCurrentPrice}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 28 }}>
              {isEdit && (
                <Pressable testID="inv-delete" disabled={saving} onPress={del} style={[styles.saveBtn, { backgroundColor: theme.colors.dangerDim, borderWidth: 1, borderColor: theme.colors.danger, flex: 0, paddingHorizontal: 20 }]}>
                  <Ionicons name="trash" size={18} color={theme.colors.danger} />
                </Pressable>
              )}
              <Pressable
                testID="save-investment-btn"
                disabled={saving}
                onPress={save}
                style={[styles.saveBtn, { flex: 1, marginTop: 0 }]}
              >
                <Text style={styles.saveText}>{saving ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Kaydet'}</Text>
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
  title: { color: theme.colors.onSurface, fontSize: 18, fontWeight: '800' },
  fieldLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  typeGrid: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  typeLabel: { color: theme.colors.onSurfaceMuted, fontSize: 12, fontWeight: '700' },
  input: { backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, color: theme.colors.onSurface, fontSize: 15 },
  curBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  curActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  curLabel: { color: theme.colors.onSurfaceMuted, fontSize: 13, fontWeight: '700' },
  saveBtn: { marginTop: 28, paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: theme.colors.brand },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
