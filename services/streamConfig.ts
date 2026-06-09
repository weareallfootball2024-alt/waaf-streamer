import * as SecureStore from 'expo-secure-store';

import { getRtmpLiveUrl } from '../constants/api';
import {
  DEFAULT_STREAM_SETTINGS,
  StreamPlatform,
  StreamSettings,
  VkPlatformConfig,
} from '../constants/streamPlatforms';
import { getPlaylistSessionRtmp } from './vkPlaylistSession';

const SETTINGS_KEY = 'waaf_stream_settings';

function normalizeVkConfig(vk: Partial<VkPlatformConfig> | undefined): VkPlatformConfig {
  const base = { ...DEFAULT_STREAM_SETTINGS.vk, ...vk };
  if (!base.streamTarget) {
    base.streamTarget = 'wall';
  }
  if (base.vkRelayThroughWaaf === undefined) {
    base.vkRelayThroughWaaf = true;
  }
  return base;
}

export async function loadStreamSettings(): Promise<StreamSettings> {
  try {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_STREAM_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<StreamSettings>;
    return {
      ...DEFAULT_STREAM_SETTINGS,
      ...parsed,
      vk: normalizeVkConfig(parsed.vk),
      youtube: { ...DEFAULT_STREAM_SETTINGS.youtube, ...parsed.youtube },
      rutube: { ...DEFAULT_STREAM_SETTINGS.rutube, ...parsed.rutube },
      waaf: { ...DEFAULT_STREAM_SETTINGS.waaf, ...parsed.waaf },
    };
  } catch {
    return { ...DEFAULT_STREAM_SETTINGS };
  }
}

export async function saveStreamSettings(settings: StreamSettings): Promise<void> {
  const toSave = { ...settings };
  if (toSave.vk.streamTarget === 'playlist') {
    toSave.vk = {
      ...toSave.vk,
      rtmpUrl: '',
      streamKey: '',
    };
  }
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(toSave));
}

export function getActiveRtmpConfig(
  settings: StreamSettings,
  matchId?: number | null,
): { rtmpUrl: string; streamKey: string; platform: StreamPlatform; relayToVk?: boolean } | null {
  const platform = settings.activePlatform;
  const cfg = settings[platform];
  if (!cfg?.enabled) return null;

  if (platform === 'vk') {
    if (!settings.vk.communityId) return null;

    if (settings.vk.streamTarget === 'playlist') {
      const session = getPlaylistSessionRtmp();
      if (!session) return null;
      if (settings.vk.vkRelayThroughWaaf && matchId) {
        return {
          rtmpUrl: getRtmpLiveUrl(),
          streamKey: `match_${matchId}`,
          platform,
          relayToVk: true,
        };
      }
      return { ...session, platform };
    }

    if (!cfg.rtmpUrl?.trim() || !cfg.streamKey?.trim()) return null;

    if (settings.vk.vkRelayThroughWaaf && matchId) {
      return {
        rtmpUrl: getRtmpLiveUrl(),
        streamKey: `match_${matchId}`,
        platform,
        relayToVk: true,
      };
    }

    const url = cfg.rtmpUrl.trim();
    return {
      rtmpUrl: url.endsWith('/') ? url : `${url}/`,
      streamKey: cfg.streamKey.trim(),
      platform,
    };
  }

  if (!cfg.rtmpUrl?.trim() || !cfg.streamKey?.trim()) return null;
  const url = cfg.rtmpUrl.trim();
  return {
    rtmpUrl: url.endsWith('/') ? url : `${url}/`,
    streamKey: cfg.streamKey.trim(),
    platform,
  };
}

export function getStreamSetupHint(settings: StreamSettings): string {
  if (settings.activePlatform !== 'vk') {
    return 'Укажите платформу и RTMP URL + ключ в настройках';
  }
  if (!settings.vk.communityId) {
    return 'Войдите через VK и выберите сообщество в настройках трансляции';
  }
  if (settings.vk.streamTarget === 'playlist') {
    return 'Вставьте RTMP URL и ключ из VK Studio для этой трансляции (режим плейлист) и нажмите «Применить для эфира»';
  }
  if (settings.vk.vkRelayThroughWaaf) {
    return 'RTMP VK из Studio сохраните в настройках — сервер WAAF добавит счёт в эфир и отправит в VK';
  }
  return 'Скопируйте постоянный RTMP URL и ключ из VK Studio → Ключи и виджеты (режим стена)';
}

export function isStreamConfigured(settings: StreamSettings): boolean {
  return getActiveRtmpConfig(settings) !== null;
}
