import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DEFAULT_STREAM_SETTINGS,
  PLATFORM_LABELS,
  REPLAY_SECONDS_OPTIONS,
  SCOREBOARD_LAYOUT_HINTS,
  SCOREBOARD_LAYOUT_LABELS,
  STUB_PLATFORMS,
  STREAM_QUALITY_HINTS,
  STREAM_QUALITY_LABELS,
  StreamPlatform,
  StreamQuality,
  ScoreboardLayout,
  StreamSettings,
  VkStreamTarget,
  type AdClipPreset,
} from '../constants/streamPlatforms';
import { copyAdClipToStorage, MAX_CLIPS, newAdClipId, trimAdClips } from '../services/adClips';
import { clearSession, getUser, login, restoreSession, saveSession } from '../services/authSession';
import { linkWaafAccount } from '../services/streamApi';
import { loadStreamSettings, saveStreamSettings } from '../services/streamConfig';
import { getPlaylistSessionRtmp, setPlaylistSessionRtmp } from '../services/vkPlaylistSession';
import {
  clearVkToken,
  ensureStoredVkUserId,
  fetchAdminGroups,
  fetchGroupAlbums,
  getStoredVkToken,
  getStoredVkUserId,
  loginWithVk,
  resolveCommunity,
  VkAlbum,
  VkGroup,
} from '../services/vkAuth';
import type { StaffUser } from '../utils/roles';

type Props = {
  onClose: () => void;
};

function formatGroupsError(msg: string): string {
  if (!msg.includes('groups') && !/profile type/i.test(msg)) return msg;
  return msg.includes('вручную') ? msg : `${msg} Укажите сообщество вручную ниже.`;
}

export function StreamSettingsScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<StreamSettings>({ ...DEFAULT_STREAM_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vkLoading, setVkLoading] = useState(false);
  const [groups, setGroups] = useState<VkGroup[]>([]);
  const [albums, setAlbums] = useState<VkAlbum[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [vkLoggedIn, setVkLoggedIn] = useState(false);
  const [playlistRtmpUrl, setPlaylistRtmpUrl] = useState('');
  const [playlistStreamKey, setPlaylistStreamKey] = useState('');
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [communityInput, setCommunityInput] = useState('');
  const [resolveLoading, setResolveLoading] = useState(false);
  const [waafUser, setWaafUser] = useState<StaffUser | null>(null);
  const [waafPhone, setWaafPhone] = useState('');
  const [waafPassword, setWaafPassword] = useState('');
  const [waafLoading, setWaafLoading] = useState(false);
  const [vkUserId, setVkUserId] = useState<string | null>(null);
  const [linkMode, setLinkMode] = useState(false);

  const loadAlbums = async (groupId: number) => {
    setAlbumsLoading(true);
    setAlbums([]);
    try {
      setAlbums(await fetchGroupAlbums(groupId));
    } catch {
      /* плейлисты опциональны — video scope может быть недоступен */
    } finally {
      setAlbumsLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const saved = await loadStreamSettings();
      setSettings(saved);
      const playlistSession = getPlaylistSessionRtmp();
      if (playlistSession) {
        setPlaylistRtmpUrl(playlistSession.rtmpUrl);
        setPlaylistStreamKey(playlistSession.streamKey);
      }
      const token = await getStoredVkToken();
      let storedVkId = await getStoredVkUserId();
      if (token && !storedVkId) {
        storedVkId = await ensureStoredVkUserId();
      }
      setVkUserId(storedVkId);
      setVkLoggedIn(!!token);
      const user = (await restoreSession()) || (await getUser());
      setWaafUser(user);
      if (token) {
        try {
          const list = await fetchAdminGroups(token);
          setGroups(list);
          if (list.length === 0) {
            setGroupsError(
              'Список пуст. Укажите сообщество вручную ниже или дождитесь одобрения scope groups от VK.',
            );
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Ошибка загрузки сообществ';
          setGroupsError(formatGroupsError(msg));
        }
        if (saved.vk.communityId && saved.vk.streamTarget === 'playlist') {
          await loadAlbums(saved.vk.communityId);
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
      if (
        settings.vk.streamTarget === 'playlist' &&
        playlistRtmpUrl.trim() &&
        playlistStreamKey.trim()
      ) {
        setPlaylistSessionRtmp(playlistRtmpUrl, playlistStreamKey);
      }
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
    setGroupsError(null);
    try {
      const token = await loginWithVk();
      setVkLoggedIn(true);
      setVkUserId(await getStoredVkUserId());
      try {
        const list = await fetchAdminGroups(token);
        setGroups(list);
        if (list.length === 0) {
          setGroupsError(
            'Список пуст. Укажите сообщество вручную ниже или дождитесь одобрения scope groups от VK.',
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Ошибка загрузки сообществ';
        setGroups([]);
        setGroupsError(formatGroupsError(msg));
      }
    } catch (e: unknown) {
      Alert.alert('VK', e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      setVkLoading(false);
    }
  };

  const handleWaafLogin = async () => {
    if (!waafPhone.trim() || !waafPassword) {
      Alert.alert('WAAF', 'Введите телефон и пароль');
      return;
    }
    setWaafLoading(true);
    try {
      const result = await login(waafPhone.trim(), waafPassword);
      if (!result.ok || !result.user) {
        Alert.alert('WAAF', result.error || 'Ошибка входа');
        return;
      }
      setWaafUser(result.user);
      setWaafPassword('');
      setLinkMode(false);
      Alert.alert('Готово', `Вошли как ${result.user.full_name || 'пользователь WAAF'}`);
    } finally {
      setWaafLoading(false);
    }
  };

  const handleWaafLogout = async () => {
    await clearSession();
    setWaafUser(null);
    setLinkMode(false);
  };

  const handleLinkWaaf = async () => {
    const vkId = vkUserId || (await getStoredVkUserId());
    if (!vkId) {
      Alert.alert('VK', 'Сначала войдите через VK');
      return;
    }
    if (!waafPhone.trim() || !waafPassword) {
      Alert.alert('WAAF', 'Введите телефон и пароль аккаунта WAAF');
      return;
    }
    setWaafLoading(true);
    try {
      const data = await linkWaafAccount(waafPhone.trim(), waafPassword, vkId);
      await saveSession(data.token, data.user as StaffUser);
      setWaafUser(data.user as StaffUser);
      setWaafPassword('');
      setLinkMode(false);
      Alert.alert('Готово', 'VK привязан к аккаунту WAAF');
    } catch (e: unknown) {
      Alert.alert('Ошибка', e instanceof Error ? e.message : 'Не удалось привязать');
    } finally {
      setWaafLoading(false);
    }
  };

  const handleVkLogout = async () => {
    await clearVkToken();
    setVkUserId(null);
    setVkLoggedIn(false);
    setGroups([]);
    setAlbums([]);
    setGroupsError(null);
    updatePlatform('vk', {
      communityId: undefined,
      communityName: undefined,
      communityPhoto: undefined,
      albumId: undefined,
      albumTitle: undefined,
    });
  };

  const selectCommunity = (group: VkGroup) => {
    updatePlatform('vk', {
      communityId: group.id,
      communityName: group.name,
      communityPhoto: group.photo || undefined,
      albumId: undefined,
      albumTitle: undefined,
    });
    if (settings.vk.streamTarget === 'playlist') {
      loadAlbums(group.id);
    }
  };

  const handleApplyCommunity = async () => {
    const trimmed = communityInput.trim();
    if (!trimmed) {
      Alert.alert('Сообщество', 'Введите ссылку или ID сообщества');
      return;
    }
    setResolveLoading(true);
    try {
      const group = await resolveCommunity(trimmed);
      selectCommunity(group);
      setCommunityInput('');
      setGroupsError(null);
    } catch (e: unknown) {
      Alert.alert('Сообщество', e instanceof Error ? e.message : 'Не удалось найти сообщество');
    } finally {
      setResolveLoading(false);
    }
  };

  const setStreamTarget = (target: VkStreamTarget) => {
    updatePlatform('vk', { streamTarget: target, albumId: undefined, albumTitle: undefined });
    if (target === 'playlist' && settings.vk.communityId) {
      loadAlbums(settings.vk.communityId);
    }
  };

  const applyPlaylistRtmp = () => {
    if (!playlistRtmpUrl.trim() || !playlistStreamKey.trim()) {
      Alert.alert('RTMP', 'Укажите URL и ключ трансляции');
      return;
    }
    setPlaylistSessionRtmp(playlistRtmpUrl, playlistStreamKey);
    Alert.alert('Готово', 'RTMP применён для текущего эфира');
  };

  const addAdClip = async () => {
    if (settings.adClips.length >= MAX_CLIPS) {
      Alert.alert('Ролики', `Максимум ${MAX_CLIPS} пресета`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Доступ', 'Нужен доступ к файлам на телефоне');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    try {
      const id = newAdClipId();
      const uri = await copyAdClipToStorage(result.assets[0].uri, id);
      const title = `Ролик ${settings.adClips.length + 1}`;
      setSettings((prev) => ({
        ...prev,
        adClips: trimAdClips([...prev.adClips, { id, title, uri }]),
      }));
    } catch {
      Alert.alert('Ошибка', 'Не удалось сохранить ролик');
    }
  };

  const removeAdClip = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      adClips: prev.adClips.filter((c) => c.id !== id),
    }));
  };

  const renameAdClip = (id: string, title: string) => {
    setSettings((prev) => ({
      ...prev,
      adClips: prev.adClips.map((c) => (c.id === id ? { ...c, title } : c)),
    }));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e31e24" size="large" />
      </View>
    );
  }

  const activeCfg = settings[settings.activePlatform];
  const vk = settings.vk;
  const hasCommunity = !!vk.communityId;

  const footerPad = Math.max(insets.bottom, 12);
  const sidePad = Math.max(insets.left, insets.right, 16);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8), paddingHorizontal: sidePad }]}>
        <Text style={styles.title}>НАСТРОЙКИ ТРАНСЛЯЦИИ</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: sidePad, paddingBottom: 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>Качество трансляции</Text>
        <View style={styles.platformRow}>
          {(['high', 'medium', 'low', 'auto'] as StreamQuality[]).map((q) => {
            const active = settings.streamQuality === q;
            return (
              <TouchableOpacity
                key={q}
                style={[styles.platformChip, active && styles.platformChipActive]}
                onPress={() => setSettings((prev) => ({ ...prev, streamQuality: q }))}
              >
                <Text style={[styles.platformChipText, active && styles.platformChipTextActive]}>
                  {STREAM_QUALITY_LABELS[q]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.hint}>{STREAM_QUALITY_HINTS[settings.streamQuality]}</Text>

        <Text style={styles.sectionTitle}>Табло в эфире</Text>
        <View style={styles.platformRow}>
          {(['full', 'center', 'left', 'right'] as ScoreboardLayout[]).map((layout) => {
            const active = settings.scoreboardLayout === layout;
            return (
              <TouchableOpacity
                key={layout}
                style={[styles.platformChip, active && styles.platformChipActive]}
                onPress={() => setSettings((prev) => ({ ...prev, scoreboardLayout: layout }))}
              >
                <Text style={[styles.platformChipText, active && styles.platformChipTextActive]}>
                  {SCOREBOARD_LAYOUT_LABELS[layout]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.hint}>{SCOREBOARD_LAYOUT_HINTS[settings.scoreboardLayout]}</Text>

        <Text style={styles.sectionTitle}>Повтор в эфире</Text>
        <View style={styles.block}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockTitle}>Повтор</Text>
              <Text style={styles.hint}>
                Кнопка «ПОВТОР» на пульте — вставляет в трансляцию последние секунды с камеры.
              </Text>
            </View>
            <Switch
              value={settings.replayEnabled}
              onValueChange={(replayEnabled) => setSettings((prev) => ({ ...prev, replayEnabled }))}
              trackColor={{ false: '#444', true: '#1a4384' }}
              thumbColor={settings.replayEnabled ? '#4cd964' : '#ccc'}
            />
          </View>
          {settings.replayEnabled && (
            <>
              <Text style={[styles.hint, { marginTop: 4 }]}>Длительность клипа (до 15 сек):</Text>
              <View style={styles.platformRow}>
                {REPLAY_SECONDS_OPTIONS.map((sec) => {
                  const active = settings.replaySeconds === sec;
                  return (
                    <TouchableOpacity
                      key={sec}
                      style={[styles.platformChip, active && styles.platformChipActive]}
                      onPress={() => setSettings((prev) => ({ ...prev, replaySeconds: sec }))}
                    >
                      <Text style={[styles.platformChipText, active && styles.platformChipTextActive]}>
                        {sec} сек
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Ролики для эфира</Text>
        <View style={styles.block}>
          <Text style={styles.hint}>
            MP4 H.264 — для перерывов и рекламы. До {MAX_CLIPS} пресетов. Лучше 720p.
          </Text>
          {settings.adClips.map((clip: AdClipPreset) => (
            <View key={clip.id} style={styles.adClipRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={clip.title}
                onChangeText={(t) => renameAdClip(clip.id, t)}
                placeholderTextColor="#666"
              />
              <TouchableOpacity onPress={() => removeAdClip(clip.id)} style={styles.adClipRemove}>
                <Text style={styles.linkOut}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {settings.adClips.length < MAX_CLIPS && (
            <TouchableOpacity style={styles.btnApply} onPress={addAdClip}>
              <Text style={styles.btnApplyText}>+ ДОБАВИТЬ РОЛИК</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>Аккаунт для оплаты эфира</Text>
        <View style={styles.block}>
          {waafUser ? (
            <>
              <Text style={styles.blockTitle}>WAAF: {waafUser.full_name || waafUser.phone}</Text>
              <Text style={styles.hint}>
                Организаторы и привязанные аккаунты оплачивают через WAAF. Турнирные матчи — бесплатно.
              </Text>
              <TouchableOpacity onPress={handleWaafLogout}>
                <Text style={styles.linkOut}>Выйти из WAAF</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.hint}>
                Организатор — войдите по телефону WAAF. Остальные могут оплатить по VK ID после входа через VK ниже.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Телефон"
                placeholderTextColor="#666"
                value={waafPhone}
                onChangeText={setWaafPhone}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="Пароль"
                placeholderTextColor="#666"
                value={waafPassword}
                onChangeText={setWaafPassword}
                secureTextEntry
              />
              <TouchableOpacity style={styles.btnVk} onPress={handleWaafLogin} disabled={waafLoading}>
                {waafLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnVkText}>ВОЙТИ В WAAF</Text>
                )}
              </TouchableOpacity>
              {vkLoggedIn && vkUserId && (
                <TouchableOpacity
                  style={[styles.btnApply, { marginTop: 10 }]}
                  onPress={() => (linkMode ? handleLinkWaaf() : setLinkMode(true))}
                  disabled={waafLoading}
                >
                  <Text style={styles.btnApplyText}>
                    {linkMode ? 'ПРИВЯЗАТЬ VK К WAAF' : 'ПРИВЯЗАТЬ VK К АККАУНТУ WAAF'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
          {vkUserId && !waafUser && (
            <Text style={[styles.hint, { marginTop: 10 }]}>VK ID: {vkUserId}</Text>
          )}
        </View>

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
                {groupsError && <Text style={styles.errorText}>{groupsError}</Text>}
                {groups.length === 0 && !groupsError && (
                  <Text style={styles.empty}>Нет сообществ с правами администратора</Text>
                )}
                {groups.map((g) => {
                  const selected = vk.communityId === g.id;
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
                <Text style={[styles.hint, { marginTop: 12 }]}>
                  Или укажите сообщество вручную (club123, waafootball или ссылка vk.com/waafootball):
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ссылка или ID сообщества"
                  placeholderTextColor="#666"
                  value={communityInput}
                  onChangeText={setCommunityInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.btnApply}
                  onPress={handleApplyCommunity}
                  disabled={resolveLoading}
                >
                  {resolveLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnApplyText}>ПРИМЕНИТЬ</Text>
                  )}
                </TouchableOpacity>
                {hasCommunity && vk.communityName && (
                  <View style={[styles.groupRow, styles.groupRowSelected, { marginTop: 8 }]}>
                    {vk.communityPhoto ? (
                      <Image source={{ uri: vk.communityPhoto }} style={styles.groupPhoto} />
                    ) : (
                      <View style={styles.groupPhotoPlaceholder} />
                    )}
                    <Text style={styles.groupName}>{vk.communityName}</Text>
                  </View>
                )}
              </>
            )}

            {hasCommunity && (
              <>
                <Text style={[styles.blockTitle, { marginTop: 16 }]}>Трансляция VK</Text>
                <Text style={[styles.hint, { marginBottom: 8 }]}>
                  {vkLoggedIn
                    ? 'При ЭФИР приложение создаёт трансляцию через VK API (как SportCam): ключи и завершение по СТОП — автоматически. Поля RTMP ниже — только запасной вариант.'
                    : 'Войдите через VK выше — тогда ключи и завершение эфира работают автоматически. Без VK — вставьте RTMP из Studio вручную.'}
                </Text>

                <Text style={[styles.blockTitle, { marginTop: 8 }]}>Куда публикуется эфир</Text>
                <View style={styles.platformRow}>
                  <TouchableOpacity
                    style={[styles.platformChip, vk.streamTarget === 'wall' && styles.platformChipActive]}
                    onPress={() => setStreamTarget('wall')}
                  >
                    <Text style={[styles.platformChipText, vk.streamTarget === 'wall' && styles.platformChipTextActive]}>
                      Раздел «Видео»
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.platformChip, vk.streamTarget === 'playlist' && styles.platformChipActive]}
                    onPress={() => setStreamTarget('playlist')}
                  >
                    <Text style={[styles.platformChipText, vk.streamTarget === 'playlist' && styles.platformChipTextActive]}>
                      Пост на стене
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.hint, { marginBottom: 10 }]}>
                  {vk.streamTarget === 'playlist'
                    ? 'С входом через VK: пост на стене создаётся при ЭФИР (wallpost). Без VK — создайте трансляцию в Studio и вставьте RTMP вручную.'
                    : 'Постоянный ключ Studio — только раздел «Видео», не стена. Для стены выберите «Пост на стене» и войдите через VK.'}
                </Text>

                <Text style={[styles.blockTitle, { marginTop: 4 }]}>Запасные ключи Studio (необязательно)</Text>

                {vk.streamTarget === 'wall' && (
                  <>
                    <Text style={styles.hint}>
                      Studio → Ключи и виджеты. Используйте, если VK API недоступен (нет scope video).
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="RTMP URL сервера"
                      placeholderTextColor="#666"
                      value={vk.rtmpUrl}
                      onChangeText={(t) => updatePlatform('vk', { rtmpUrl: t })}
                      autoCapitalize="none"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Ключ трансляции (stream key)"
                      placeholderTextColor="#666"
                      value={vk.streamKey}
                      onChangeText={(t) => updatePlatform('vk', { streamKey: t })}
                      autoCapitalize="none"
                      secureTextEntry
                    />
                  </>
                )}

                {vk.streamTarget === 'playlist' && (
                  <>
                    <Text style={styles.hint}>
                      Studio → Трансляции. Только если VK API не сработал — вставьте RTMP вручную.
                    </Text>
                    {albumsLoading && <ActivityIndicator color="#888" style={{ marginBottom: 8 }} />}
                    {albums.length > 0 && (
                      <>
                        <Text style={styles.hint}>Плейлисты видео (справочно):</Text>
                        {albums.map((a) => {
                          const selected = vk.albumId === a.id;
                          return (
                            <TouchableOpacity
                              key={a.id}
                              style={[styles.groupRow, selected && styles.groupRowSelected]}
                              onPress={() => updatePlatform('vk', { albumId: a.id, albumTitle: a.title })}
                            >
                              <Text style={styles.groupName}>{a.title}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </>
                    )}
                    <TextInput
                      style={styles.input}
                      placeholder="RTMP URL для этой трансляции"
                      placeholderTextColor="#666"
                      value={playlistRtmpUrl}
                      onChangeText={setPlaylistRtmpUrl}
                      autoCapitalize="none"
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Ключ этой трансляции"
                      placeholderTextColor="#666"
                      value={playlistStreamKey}
                      onChangeText={setPlaylistStreamKey}
                      autoCapitalize="none"
                      secureTextEntry
                    />
                    <TouchableOpacity style={styles.btnApply} onPress={applyPlaylistRtmp}>
                      <Text style={styles.btnApplyText}>ПРИМЕНИТЬ ЗАПАСНЫЕ КЛЮЧИ</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
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

      <View style={[styles.footer, { paddingBottom: footerPad, paddingHorizontal: sidePad }]}>
        <TouchableOpacity style={styles.footerBtnBack} onPress={onClose} activeOpacity={0.8}>
          <Text style={styles.footerBtnBackText}>← НАЗАД</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.footerBtnSave, saving && styles.footerBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.footerBtnSaveText}>СОХРАНИТЬ</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#121212' },
  center: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#121212',
  },
  title: { color: '#fff', fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
    backgroundColor: '#121212',
  },
  footerBtnBack: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2a',
  },
  footerBtnBackText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  footerBtnSave: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d6a2d',
  },
  footerBtnDisabled: { opacity: 0.6 },
  footerBtnSaveText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 16 },
  sectionTitle: { color: '#aaa', fontSize: 13, marginBottom: 10, fontWeight: '600' },
  platformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
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
  errorText: { color: '#ff6b6b', fontSize: 12, marginBottom: 8 },
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
  btnApply: {
    backgroundColor: '#2d6a2d',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  btnApplyText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  vkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
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
  adClipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  adClipRemove: { padding: 8 },
});
