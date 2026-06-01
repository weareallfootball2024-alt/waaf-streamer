import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  DEFAULT_STREAM_SETTINGS,
  PLATFORM_LABELS,
  STUB_PLATFORMS,
  StreamPlatform,
  StreamSettings,
} from '../constants/streamPlatforms';
import { loadStreamSettings, saveStreamSettings } from '../services/streamConfig';
import {
  clearVkToken,
  fetchAdminGroups,
  getStoredVkToken,
  loginWithVk,
  VkGroup,
} from '../services/vkAuth';

type Props = {
  onClose: () => void;
};

export function StreamSettingsScreen({ onClose }: Props) {
  const [settings, setSettings] = useState<StreamSettings>({ ...DEFAULT_STREAM_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vkLoading, setVkLoading] = useState(false);
  const [groups, setGroups] = useState<VkGroup[]>([]);
  const [vkLoggedIn, setVkLoggedIn] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await loadStreamSettings();
      setSettings(saved);
      const token = await getStoredVkToken();
      setVkLoggedIn(!!token);
      if (token) {
        try {
          setGroups(await fetchAdminGroups(token));
        } catch {
          /* ignore */
        }
      }
      setLoading(false);
    })();
  }, []);

  const updatePlatform = (platform: StreamPlatform, patch: Partial<StreamSettings[StreamPlatform]>) => {
    setSettings((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], ...patch },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveStreamSettings(settings);
      Alert.alert('Сохранено', 'Настройки трансляции обновлены');
      onClose();
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить настройки');
    } finally {
      setSaving(false);
    }
  };

  const handleVkLogin = async () => {
    setVkLoading(true);
    try {
      const token = await loginWithVk();
      setVkLoggedIn(true);
      setGroups(await fetchAdminGroups(token));
    } catch (e: unknown) {
      Alert.alert('VK', e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      setVkLoading(false);
    }
  };

  const handleVkLogout = async () => {
    await clearVkToken();
    setVkLoggedIn(false);
    setGroups([]);
    updatePlatform('vk', { communityId: undefined, communityName: undefined, communityPhoto: undefined });
  };

  const selectCommunity = (group: VkGroup) => {
    updatePlatform('vk', {
      communityId: group.id,
      communityName: group.name,
      communityPhoto: group.photo || undefined,
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e31e24" size="large" />
      </View>
    );
  }

  const activeCfg = settings[settings.activePlatform];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.back}>← НАЗАД</Text>
        </TouchableOpacity>
        <Text style={styles.title}>НАСТРОЙКИ ТРАНСЛЯЦИИ</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.save}>СОХРАНИТЬ</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Куда стримить</Text>
        <View style={styles.platformRow}>
          {(Object.keys(PLATFORM_LABELS) as StreamPlatform[]).map((p) => {
            const isStub = STUB_PLATFORMS.includes(p);
            const active = settings.activePlatform === p;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.platformChip, active && styles.platformChipActive, isStub && styles.platformChipStub]}
                onPress={() => {
                  if (isStub) {
                    Alert.alert('Скоро', `${PLATFORM_LABELS[p]} будет доступен в следующих версиях`);
                    return;
                  }
                  setSettings((prev) => ({ ...prev, activePlatform: p }));
                }}
              >
                <Text style={[styles.platformChipText, active && styles.platformChipTextActive]}>
                  {PLATFORM_LABELS[p]}{isStub ? ' · скоро' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {settings.activePlatform === 'vk' && (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>VK Live — сообщество</Text>
            {!vkLoggedIn ? (
              <TouchableOpacity style={styles.btnVk} onPress={handleVkLogin} disabled={vkLoading}>
                {vkLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnVkText}>ВОЙТИ ЧЕРЕЗ VK</Text>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <View style={styles.vkRow}>
                  <Text style={styles.hint}>Выберите сообщество, где вы администратор:</Text>
                  <TouchableOpacity onPress={handleVkLogout}>
                    <Text style={styles.linkOut}>Выйти</Text>
                  </TouchableOpacity>
                </View>
                {groups.length === 0 && (
                  <Text style={styles.empty}>Нет сообществ с правами администратора</Text>
                )}
                {groups.map((g) => {
                  const selected = settings.vk.communityId === g.id;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.groupRow, selected && styles.groupRowSelected]}
                      onPress={() => selectCommunity(g)}
                    >
                      {g.photo ? (
                        <Image source={{ uri: g.photo }} style={styles.groupPhoto} />
                      ) : (
                        <View style={styles.groupPhotoPlaceholder} />
                      )}
                      <Text style={styles.groupName}>{g.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            <Text style={[styles.blockTitle, { marginTop: 16 }]}>RTMP (из VK Studio → Ключи)</Text>
            <Text style={styles.hint}>URL сервера и ключ трансляции из раздела «Ключи и виджеты»</Text>
            <TextInput
              style={styles.input}
              placeholder="RTMP URL сервера"
              placeholderTextColor="#666"
              value={settings.vk.rtmpUrl}
              onChangeText={(t) => updatePlatform('vk', { rtmpUrl: t })}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Ключ трансляции (stream key)"
              placeholderTextColor="#666"
              value={settings.vk.streamKey}
              onChangeText={(t) => updatePlatform('vk', { streamKey: t })}
              autoCapitalize="none"
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Embed-URL для miniapp (необязательно)"
              placeholderTextColor="#666"
              value={settings.vk.embedUrl || ''}
              onChangeText={(t) => updatePlatform('vk', { embedUrl: t })}
              autoCapitalize="none"
            />
          </View>
        )}

        {settings.activePlatform !== 'vk' && !STUB_PLATFORMS.includes(settings.activePlatform) && (
          <View style={styles.block}>
            <TextInput
              style={styles.input}
              placeholder="RTMP URL"
              placeholderTextColor="#666"
              value={activeCfg.rtmpUrl}
              onChangeText={(t) => updatePlatform(settings.activePlatform, { rtmpUrl: t })}
            />
            <TextInput
              style={styles.input}
              placeholder="Stream key"
              placeholderTextColor="#666"
              value={activeCfg.streamKey}
              onChangeText={(t) => updatePlatform(settings.activePlatform, { streamKey: t })}
              secureTextEntry
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#121212' },
  center: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  back: { color: '#e31e24', fontWeight: 'bold', fontSize: 14 },
  title: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  save: { color: '#4cd964', fontWeight: 'bold', fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: { color: '#aaa', fontSize: 13, marginBottom: 10, fontWeight: '600' },
  platformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  platformChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
  },
  platformChipActive: { backgroundColor: '#1a4384', borderColor: '#4a90e2' },
  platformChipStub: { opacity: 0.55 },
  platformChipText: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  platformChipTextActive: { color: '#fff' },
  block: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 12 },
  blockTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginBottom: 8 },
  hint: { color: '#888', fontSize: 12, marginBottom: 10 },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#444',
  },
  btnVk: {
    backgroundColor: '#0077FF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnVkText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  vkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  linkOut: { color: '#e31e24', fontSize: 13 },
  empty: { color: '#666', fontStyle: 'italic', marginBottom: 8 },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#252525',
  },
  groupRowSelected: { backgroundColor: '#1a4384', borderWidth: 1, borderColor: '#4a90e2' },
  groupPhoto: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  groupPhotoPlaceholder: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#444' },
  groupName: { color: '#fff', fontSize: 14, flex: 1 },
});
