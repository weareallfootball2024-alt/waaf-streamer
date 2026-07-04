import * as SecureStore from 'expo-secure-store';

import {
  DEFAULT_STREAM_SETTINGS,
  ScoreboardLayout,
  StreamPlatform,
  StreamQuality,
  StreamSettings,
  VkPlatformConfig,
} from '../constants/streamPlatforms';

const VALID_QUALITIES: StreamQuality[] = ['high', 'medium', 'low', 'auto'];
const VALID_SCOREBOARD_LAYOUTS: ScoreboardLayout[] = ['full', 'center', 'left', 'right'];

function normalizeStreamQuality(value: unknown): StreamQuality {
  if (typeof value === 'string' && VALID_QUALITIES.includes(value as StreamQuality)) {
    return value as StreamQuality;
  }
  return DEFAULT_STREAM_SETTINGS.streamQuality;
}

function normalizeScoreboardLayout(value: unknown): ScoreboardLayout {
  if (typeof value === 'string' && VALID_SCOREBOARD_LAYOUTS.includes(value as ScoreboardLayout)) {
    return value as ScoreboardLayout;
  }
  return DEFAULT_STREAM_SETTINGS.scoreboardLayout;
}
import { getPlaylistSessionRtmp, hydratePlaylistSessionRtmp } from './vkPlaylistSession';
import { loadVkLiveSession } from './vkLiveSession';

const SETTINGS_KEY = 'waaf_stream_settings';

function normalizeVkConfig(vk: Partial<VkPlatformConfig> | undefined): VkPlatformConfig {
  const base = { ...DEFAULT_STREAM_SETTINGS.vk, ...vk };
  if (!base.streamTarget) {
    base.streamTarget = 'wall';
  }
  base.streamSource = 'manual';
  return base;
}

function normalizeReplaySeconds(value: unknown): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return DEFAULT_STREAM_SETTINGS.replaySeconds;
  return Math.min(15, Math.max(1, Math.round(n)));
}

export async function loadStreamSettings(): Promise<StreamSettings> {
  await hydratePlaylistSessionRtmp();
  try {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_STREAM_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<StreamSettings>;
    return {
      ...DEFAULT_STREAM_SETTINGS,
      ...parsed,
      streamQuality: normalizeStreamQuality(parsed.streamQuality),
      scoreboardLayout: normalizeScoreboardLayout(parsed.scoreboardLayout),
      replayEnabled: parsed.replayEnabled !== false,
      replaySeconds: normalizeReplaySeconds(parsed.replaySeconds),
      adClips: Array.isArray(parsed.adClips) ? parsed.adClips.slice(0, 3) : [],
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
  _matchId?: number | null,
  manualRtmp?: { rtmpUrl: string; streamKey: string } | null,
): { rtmpUrl: string; streamKey: string; platform: StreamPlatform } | null {
  if (manualRtmp?.rtmpUrl?.trim() && manualRtmp?.streamKey?.trim()) {
    const url = manualRtmp.rtmpUrl.trim();
    return {
      rtmpUrl: url.endsWith('/') ? url : `${url}/`,
      streamKey: manualRtmp.streamKey.trim(),
      platform: settings.activePlatform,
    };
  }

  const platform = settings.activePlatform;
  const cfg = settings[platform];
  if (!cfg?.enabled) return null;

  if (platform === 'vk') {
    if (!settings.vk.communityId) return null;

    if (settings.vk.streamTarget === 'playlist') {
      const session = getPlaylistSessionRtmp();
      if (!session) return null;
      return { ...session, platform };
    }

    if (!cfg.rtmpUrl?.trim() || !cfg.streamKey?.trim()) return null;

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
  return 'Скопируйте RTMP URL и ключ из VK Studio → Ключи и виджеты. Счёт вшивается в эфир на телефоне.';
}

export function getVkShareUrl(settings: StreamSettings): string | null {
  const embed = settings.vk.embedUrl?.trim();
  if (embed) return embed;
  if (settings.vk.communityId) {
    return `https://vk.com/club${settings.vk.communityId}`;
  }
  return null;
}

export function isStreamConfigured(settings: StreamSettings): boolean {
  return getActiveRtmpConfig(settings) !== null;
}
