import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '@/src/components/GlassCard';
import { api } from '@/src/api';
import { theme } from '@/src/theme';

const ICONS = ['cart', 'film', 'flash', 'car', 'home', 'restaurant', 'medkit', 'code-slash', 'briefcase', 'laptop', 'gift', 'airplane', 'fitness', 'pricetag', 'book', 'paw'];
const COLORS = ['#00FF94', '#FF3366', '#FFB800', '#0090FF', '#9F7AEA', '#FF6B35', '#0066FF', '#FFD700'];

export default function CategoriesScreen() {
  const router = useRouter();
  const [cats, setCats] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [filter, setFilter] = useState<'expense' | 'income'>('expense');

  const load = useCallback(async () => {
    try { setCats(await api.listCategories()); } catch (e) { console.warn(e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = (cat: any | null) => {
    setEditing(cat ? { ...cat } : { name: '', icon: 'pricetag', color: theme.colors.brand, kind: filter });
  };

  const save = async () => {
    if (!editing) return;
    try {
      if (editing.id) {
        await api.updateCategory(editing.id, { name: editing.name, icon: editing.icon, color: editing.color, kind: editing.kind });
      } else {
        await api.createCategory({ name: editing.name, icon: editing.icon, color: editing.color, kind: editing.kind });
      }
      setEditing(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      load();
    } catch (e) { console.warn(e); }
  };

  const del = async () => {
    if (!editing?.id) return;
    try {
      await api.deleteCategory(editing.id);
      setEditing(null);
      load();
    } catch (e) { console.warn(e); }
  };

  const filtered = cats.filter(c => c.kind === filter);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0A0E27', '#050816']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Pressable testID="cats-back" onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Kategoriler</Text>
          <Pressable testID="cat-add" onPress={() => open(null)} style={[styles.closeBtn, { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand }]}>
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <View style={styles.segment}>
            {(['expense', 'income'] as const).map(k => (
              <Pressable key={k} testID={`cat-kind-${k}`} onPress={() => { Haptics.selectionAsync(); setFilter(k); }} style={[styles.segBtn, filter === k && styles.segActive]}>
                <Text style={[styles.segText, filter === k && { color: '#fff' }]}>{k === 'expense' ? 'Gider' : 'Gelir'}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
          {filtered.map(c => (
            <Pressable key={c.id} testID={`cat-${c.id}`} onPress={() => open(c)} style={{ marginBottom: 8 }}>
              <GlassCard style={{ padding: 0 }}>
                <View style={styles.row}>
                  <View style={[styles.iconBox, { backgroundColor: c.color + '22', borderColor: c.color + '55' }]}>
                    <Ionicons name={c.icon} size={18} color={c.color} />
                  </View>
                  <Text style={styles.rowTitle}>{c.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.onSurfaceMuted} />
                </View>
              </GlassCard>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setEditing(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{editing?.id ? 'Kategori Düzenle' : 'Yeni Kategori'}</Text>

            <Text style={styles.fieldLabel}>İsim</Text>
            <TextInput
              testID="cat-name"
              placeholder="Kategori adı"
              placeholderTextColor={theme.colors.onSurfaceDim}
              value={editing?.name || ''}
              onChangeText={v => setEditing((e: any) => ({ ...e, name: v }))}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Tip</Text>
            <View style={styles.segment}>
              {(['expense', 'income'] as const).map(k => (
                <Pressable key={k} onPress={() => setEditing((e: any) => ({ ...e, kind: k }))} style={[styles.segBtn, editing?.kind === k && styles.segActive]}>
                  <Text style={[styles.segText, editing?.kind === k && { color: '#fff' }]}>{k === 'expense' ? 'Gider' : 'Gelir'}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>İkon</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {ICONS.map(ic => (
                <Pressable key={ic} onPress={() => setEditing((e: any) => ({ ...e, icon: ic }))} style={[styles.iconPick, editing?.icon === ic && { backgroundColor: (editing?.color || theme.colors.brand) + '33', borderColor: editing?.color || theme.colors.brand }]}>
                  <Ionicons name={ic as any} size={18} color={editing?.icon === ic ? (editing?.color || theme.colors.brand) : theme.colors.onSurfaceMuted} />
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Renk</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <Pressable key={c} onPress={() => setEditing((e: any) => ({ ...e, color: c }))} style={[styles.colorPick, { backgroundColor: c }, editing?.color === c && styles.colorPickActive]} />
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              {editing?.id && (
                <Pressable testID="cat-delete" onPress={del} style={[styles.btn, { backgroundColor: theme.colors.dangerDim, borderWidth: 1, borderColor: theme.colors.danger }]}>
                  <Ionicons name="trash" size={18} color={theme.colors.danger} />
                </Pressable>
              )}
              <Pressable testID="cat-save" onPress={save} style={[styles.btn, { flex: 1, backgroundColor: theme.colors.brand }]}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Kaydet</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  title: { color: theme.colors.onSurface, fontSize: 18, fontWeight: '800' },
  segment: { flexDirection: 'row', backgroundColor: theme.colors.glass, borderRadius: theme.radius.pill, padding: 4, borderWidth: 1, borderColor: theme.colors.border, marginTop: 12 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.pill, alignItems: 'center' },
  segActive: { backgroundColor: theme.colors.brand },
  segText: { color: theme.colors.onSurfaceMuted, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  rowTitle: { color: theme.colors.onSurface, fontSize: 14, fontWeight: '700', flex: 1 },
  sheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, borderTopWidth: 1, borderColor: theme.colors.border },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  fieldLabel: { color: theme.colors.onSurfaceMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 14 },
  input: { backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: theme.colors.onSurface, fontSize: 15 },
  iconPick: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border },
  colorPick: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorPickActive: { borderColor: '#fff' },
  btn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flexDirection: 'row', gap: 6 },
});
