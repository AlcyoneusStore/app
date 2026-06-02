import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '@/src/components/GlassCard';
import { api } from '@/src/api';
import { theme } from '@/src/theme';
import { useCurrency } from '@/src/contexts/CurrencyContext';

export default function SettingsRatesScreen() {
  const router = useRouter();
  const { refresh } = useCurrency();
  const [live, setLive] = useState<{ USD: number; RUB: number } | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [usd, setUsd] = useState('');
  const [rub, setRub] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.getRates();
      const s = await api.getSettings();
      setLive({ USD: r.live_rates.USD, RUB: r.live_rates.RUB });
      setEnabled(!!s.custom_rates_enabled);
      setUsd(s.custom_usd_try ? String(s.custom_usd_try) : '');
      setRub(s.custom_rub_try ? String(s.custom_rub_try) : '');
    } catch (e) { console.warn(e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateSettings({
        custom_rates_enabled: enabled,
        custom_usd_try: usd ? parseFloat(usd.replace(',', '.')) : null,
        custom_rub_try: rub ? parseFloat(rub.replace(',', '.')) : null,
      });
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) { console.warn(e); } finally { setSaving(false); }
  };

  const useLive = () => {
    if (live) {
      setUsd(String(live.USD));
      setRub(String(live.RUB));
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0A0E27', '#050816']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable testID="rates-back" onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.title}>Döviz Kurları</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
            {live && (
              <GlassCard>
                <Text style={styles.cardLabel}>Anlık Kurlar (exchangerate.host)</Text>
                <View style={styles.liveRow}>
                  <Text style={styles.livePair}>1 USD</Text>
                  <Text style={styles.liveValue}>= ₺{live.USD.toFixed(4)}</Text>
                </View>
                <View style={styles.liveRow}>
                  <Text style={styles.livePair}>1 RUB</Text>
                  <Text style={styles.liveValue}>= ₺{live.RUB.toFixed(4)}</Text>
                </View>
              </GlassCard>
            )}

            <Pressable
              testID="toggle-custom-rates"
              onPress={() => { Haptics.selectionAsync(); setEnabled(v => !v); }}
              style={{ marginTop: 16 }}
            >
              <GlassCard style={{ padding: 0 }}>
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>Manuel Kur Kullan</Text>
                    <Text style={styles.rowSub}>Aktif edildiğinde, sistem kendi kurun üzerinden hesaplama yapar</Text>
                  </View>
                  <View style={[styles.switchTrack, enabled && styles.switchTrackOn]}>
                    <View style={[styles.switchThumb, enabled && styles.switchThumbOn]} />
                  </View>
                </View>
              </GlassCard>
            </Pressable>

            {enabled && (
              <>
                <Pressable testID="use-live" onPress={useLive} style={[styles.useLiveBtn]}>
                  <Ionicons name="cloud-download" size={16} color={theme.colors.brand} />
                  <Text style={{ color: theme.colors.brand, fontWeight: '700', fontSize: 13 }}>Anlık kurları doldur</Text>
                </Pressable>

                <Text style={styles.fieldLabel}>1 USD = ? TL</Text>
                <TextInput
                  testID="rate-usd"
                  placeholder="örn. 34.50"
                  placeholderTextColor={theme.colors.onSurfaceDim}
                  value={usd}
                  onChangeText={setUsd}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />

                <Text style={styles.fieldLabel}>1 RUB = ? TL</Text>
                <TextInput
                  testID="rate-rub"
                  placeholder="örn. 0.36"
                  placeholderTextColor={theme.colors.onSurfaceDim}
                  value={rub}
                  onChangeText={setRub}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </>
            )}

            <Pressable testID="save-rates" disabled={saving} onPress={save} style={styles.saveBtn}>
              <Text style={styles.saveText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
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
  cardLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  liveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  livePair: { color: theme.colors.onSurface, fontSize: 14, fontWeight: '700' },
  liveValue: { color: theme.colors.success, fontSize: 16, fontWeight: '800' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  rowTitle: { color: theme.colors.onSurface, fontSize: 15, fontWeight: '700' },
  rowSub: { color: theme.colors.onSurfaceMuted, fontSize: 12, marginTop: 2 },
  switchTrack: { width: 44, height: 26, borderRadius: 13, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, padding: 2 },
  switchTrackOn: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  switchThumbOn: { transform: [{ translateX: 18 }] },
  useLiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brandTint, borderWidth: 1, borderColor: theme.colors.brand, marginTop: 16 },
  fieldLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, color: theme.colors.onSurface, fontSize: 15 },
  saveBtn: { marginTop: 28, paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: theme.colors.brand },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
