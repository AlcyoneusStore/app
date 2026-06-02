import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/src/contexts/AuthContext';
import { theme } from '@/src/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!username || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(username, password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Kullanıcı adı veya şifre hatalı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0A0E27', '#050816', '#050816']} style={StyleSheet.absoluteFill} />
      <View style={styles.glow1} pointerEvents="none" />
      <View style={styles.glow2} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.center}>
            <View style={styles.logo}>
              <Ionicons name="wallet" size={36} color="#fff" />
            </View>
            <Text style={styles.brand}>Finso</Text>
            <Text style={styles.tagline}>Premium kişisel finans yönetimi</Text>

            <View style={styles.card}>
              <Text style={styles.title}>Giriş Yap</Text>

              <Text style={styles.fieldLabel}>Kullanıcı Adı</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color={theme.colors.onSurfaceMuted} />
                <TextInput
                  testID="login-username"
                  value={username}
                  onChangeText={setUsername}
                  placeholder="admin"
                  placeholderTextColor={theme.colors.onSurfaceDim}
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>

              <Text style={styles.fieldLabel}>Şifre</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={theme.colors.onSurfaceMuted} />
                <TextInput
                  testID="login-password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••"
                  placeholderTextColor={theme.colors.onSurfaceDim}
                  secureTextEntry
                  style={styles.input}
                />
              </View>

              {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}

              <Pressable testID="login-submit" disabled={loading} onPress={onSubmit} style={[styles.btn, loading && { opacity: 0.6 }]}>
                <Text style={styles.btnText}>{loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}</Text>
              </Pressable>

              <Text style={styles.hint}>Varsayılan: admin / admin · Ayarlar'dan değiştirebilirsiniz</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  glow1: { position: 'absolute', top: -100, right: -80, width: 320, height: 320, borderRadius: 160, backgroundColor: theme.colors.brand, opacity: 0.2 },
  glow2: { position: 'absolute', bottom: -120, left: -80, width: 320, height: 320, borderRadius: 160, backgroundColor: '#9F7AEA', opacity: 0.15 },
  center: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  logo: { width: 72, height: 72, borderRadius: 20, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', shadowColor: theme.colors.brand, shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  brand: { color: '#fff', fontSize: 40, fontWeight: '900', letterSpacing: -1, textAlign: 'center', marginTop: 16 },
  tagline: { color: theme.colors.onSurfaceMuted, fontSize: 14, textAlign: 'center', marginTop: 4 },
  card: { marginTop: 36, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 24, padding: 24 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 16 },
  fieldLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 14, height: 50 },
  input: { flex: 1, color: '#fff', fontSize: 15 },
  error: { color: theme.colors.danger, fontSize: 13, marginTop: 12, fontWeight: '600' },
  btn: { marginTop: 24, height: 52, borderRadius: 14, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  hint: { color: theme.colors.onSurfaceDim, fontSize: 11, textAlign: 'center', marginTop: 16 },
});
