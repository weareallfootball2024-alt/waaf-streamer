import * as SecureStore from 'expo-secure-store';

import {
  DEFAULT_STREAM_SETTINGS,
  StreamPlatform,
  StreamSettings,
} from '../constants/streamPlatforms';

const SETTINGS_KEY = 'waaf_stream_settings';

export async function loadStreamSettings(): Promise<StreamSettings> {
  try {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_STREAM_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<StreamSettings>;
    return {
      ...DEFAULT_STREAM_SETTINGS,
      ...parsed,
      vk: { ...DEFAULT_STREAM_SETTINGS.vk, ...parsed.vk },
      youtube: { ...DEFAULT_STREAM_SETTINGS.youtube, ...parsed.youtube },
      rutube: { ...DEFAULT_STREAM_SETTINGS.rutube, ...parsed.rutube },
      waaf: { ...DEFAULT_STREAM_SETTINGS.waaf, ...parsed.waaf },
    };
  } catch {
    return { ...DEFAULT_STREAM_SETTINGS };
  }
}

export async function saveStreamSettings(settings: StreamSettings): Promise<void> {
  await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(settings));
}

export function getActiveRtmpConfig(
  settings: StreamSettings,
): { rtmpUrl: string; streamKey: string; platform: StreamPlatform } | null {
  const platform = settings.activePlatform;
  const cfg = settings[platform];
  if (!cfg?.enabled || !cfg.rtmpUrl?.trim() || !cfg.streamKey?.trim()) return null;
  const url = cfg.rtmpUrl.trim();
  return {
    rtmpUrl: url.endsWith('/') ? url : `${url}/`,
    streamKey: cfg.streamKey.trim(),
    platform,
  };
}

export function isStreamConfigured(settings: StreamSettings): boolean {
  return getActiveRtmpConfig(settings) !== null;
}
