import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/src/api';
import { useAuth } from '@/src/contexts/AuthContext';
import { theme } from '@/src/theme';

export default function SettingsAccountScreen() {
  const router = useRouter();
  const { username, logout, refresh } = useAuth();
  const [current, setCurrent] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const save = async () => {
    setErr(''); setMsg('');
    if (!current) { setErr('Mevcut şifreyi gir'); return; }
    if (!newUsername && !newPassword) { setErr('Yeni kullanıcı adı veya şifre gir'); return; }
    setSaving(true);
    try {
      await api.changeCredentials({
        current_password: current,
        new_username: newUsername || null,
        new_password: newPassword || null,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMsg('Bilgiler güncellendi. Tekrar giriş yapın.');
      setTimeout(async () => {
        await logout();
        router.replace('/login');
      }, 1200);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErr('Mevcut şifre hatalı');
    } finally {
      setSaving(false);
      refresh();
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0A0E27', '#050816']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable testID="acc-back" onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.title}>Hesap Bilgileri</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
            <View style={styles.userCard}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={24} color={theme.colors.brand} />
              </View>
              <View>
                <Text style={styles.userLabel}>Mevcut kullanıcı</Text>
                <Text style={styles.userName}>{username || '—'}</Text>
              </View>
            </View>

            <Text style={styles.section}>Kullanıcı Adı ve Şifre Değiştir</Text>

            <Text style={styles.fieldLabel}>Mevcut Şifre</Text>
            <TextInput testID="acc-current" placeholder="••••••" placeholderTextColor={theme.colors.onSurfaceDim} value={current} onChangeText={setCurrent} secureTextEntry style={styles.input} />

            <Text style={styles.fieldLabel}>Yeni Kullanıcı Adı (opsiyonel)</Text>
            <TextInput testID="acc-new-username" placeholder="boş bırakılırsa değişmez" placeholderTextColor={theme.colors.onSurfaceDim} value={newUsername} onChangeText={setNewUsername} autoCapitalize="none" style={styles.input} />

            <Text style={styles.fieldLabel}>Yeni Şifre (opsiyonel)</Text>
            <TextInput testID="acc-new-password" placeholder="boş bırakılırsa değişmez" placeholderTextColor={theme.colors.onSurfaceDim} value={newPassword} onChangeText={setNewPassword} secureTextEntry style={styles.input} />

            {err ? <Text style={[styles.msg, { color: theme.colors.danger }]}>{err}</Text> : null}
            {msg ? <Text style={[styles.msg, { color: theme.colors.success }]}>{msg}</Text> : null}

            <Pressable testID="acc-save" disabled={saving} onPress={save} style={[styles.btn, saving && { opacity: 0.6 }]}>
              <Text style={styles.btnText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
            </Pressable>

            <Pressable testID="acc-logout" onPress={async () => { await logout(); router.replace('/login'); }} style={[styles.btn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.danger, marginTop: 12 }]}>
              <Text style={[styles.btnText, { color: theme.colors.danger }]}>Çıkış Yap</Text>
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
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 20, padding: 16 },
  avatar: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.brandTint, borderWidth: 1, borderColor: theme.colors.brand },
  userLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  userName: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  section: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 28, marginBottom: 4 },
  fieldLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, color: '#fff', fontSize: 15 },
  msg: { fontSize: 13, marginTop: 12, fontWeight: '600' },
  btn: { marginTop: 24, height: 50, borderRadius: 14, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
