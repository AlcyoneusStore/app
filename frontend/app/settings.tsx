import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '@/src/components/GlassCard';
import { api } from '@/src/api';
import { theme } from '@/src/theme';

type Row = { id: string; icon: any; iconColor: string; title: string; subtitle: string; onPress: () => void; danger?: boolean };

export default function SettingsScreen() {
  const router = useRouter();
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);

  const rows: Row[] = [
    { id: 'rates', icon: 'swap-horizontal', iconColor: theme.colors.brand, title: 'Döviz Kurları', subtitle: 'Otomatik veya manuel kur ayarla', onPress: () => router.push('/settings-rates') },
    { id: 'categories', icon: 'pricetags', iconColor: theme.colors.success, title: 'Kategoriler', subtitle: 'Kategorileri düzenle, ekle, sil', onPress: () => router.push('/settings-categories') },
    { id: 'reseed', icon: 'sparkles', iconColor: theme.colors.warning, title: 'Demo Verilerini Yenile', subtitle: 'Mevcut verileri demo örneklerle değiştir', onPress: async () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); await api.seed(true); router.back(); } },
    { id: 'reset', icon: 'trash', iconColor: theme.colors.danger, title: 'Fabrika Ayarlarına Dön', subtitle: 'Tüm verileri kalıcı olarak sil', onPress: () => setConfirmReset(true), danger: true },
  ];

  const doReset = async () => {
    setResetting(true);
    try {
      await api.factoryReset();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmReset(false);
      router.back();
    } catch (e) {
      console.warn(e);
    } finally {
      setResetting(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0A0E27', '#050816']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Pressable testID="settings-back" onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Ayarlar</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          {rows.map(r => (
            <Pressable
              key={r.id}
              testID={`settings-${r.id}`}
              onPress={() => { Haptics.selectionAsync(); r.onPress(); }}
              style={{ marginBottom: 12 }}
            >
              <GlassCard style={{ padding: 0 }}>
                <View style={styles.row}>
                  <View style={[styles.iconBox, { backgroundColor: r.iconColor + '22', borderColor: r.iconColor + '55' }]}>
                    <Ionicons name={r.icon} size={20} color={r.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, r.danger && { color: theme.colors.danger }]}>{r.title}</Text>
                    <Text style={styles.rowSub}>{r.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurfaceMuted} />
                </View>
              </GlassCard>
            </Pressable>
          ))}

          <Text style={styles.footer}>Finso · v1.0 · ₺ TL ana para birimi</Text>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={confirmReset} transparent animationType="fade" onRequestClose={() => setConfirmReset(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={[styles.iconBox, { backgroundColor: theme.colors.dangerDim, borderColor: theme.colors.danger, alignSelf: 'center', width: 56, height: 56, borderRadius: 16 }]}>
              <Ionicons name="warning" size={26} color={theme.colors.danger} />
            </View>
            <Text style={styles.modalTitle}>Emin misin?</Text>
            <Text style={styles.modalText}>Tüm hesaplar, kartlar, harcamalar ve yatırımlar kalıcı olarak silinecek. Bu işlem geri alınamaz.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable testID="reset-cancel" onPress={() => setConfirmReset(false)} style={[styles.modalBtn, { backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Vazgeç</Text>
              </Pressable>
              <Pressable testID="reset-confirm" disabled={resetting} onPress={doReset} style={[styles.modalBtn, { backgroundColor: theme.colors.danger }]}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>{resetting ? 'Siliniyor...' : 'Sil'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  title: { color: theme.colors.onSurface, fontSize: 18, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  rowTitle: { color: theme.colors.onSurface, fontSize: 15, fontWeight: '700' },
  rowSub: { color: theme.colors.onSurfaceMuted, fontSize: 12, marginTop: 2 },
  footer: { color: theme.colors.onSurfaceDim, fontSize: 11, textAlign: 'center', marginTop: 24 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 24, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: theme.colors.border },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 16 },
  modalText: { color: theme.colors.onSurfaceMuted, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
});
