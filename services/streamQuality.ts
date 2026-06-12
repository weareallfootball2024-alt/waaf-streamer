import * as SecureStore from 'expo-secure-store';

import type { StreamQuality } from '../constants/streamPlatforms';

const AUTO_QUALITY_KEY = 'waaf_stream_auto_quality';

export type ResolvedStreamQuality = Exclude<StreamQuality, 'auto'>;

export type EncoderPreset = {
  quality: ResolvedStreamQuality;
  width: number;
  height: number;
  bitrate: number;
  fps: number;
};

export const ENCODER_PRESETS: Record<ResolvedStreamQuality, EncoderPreset> = {
  high: { quality: 'high', width: 1280, height: 720, bitrate: 1_500_000, fps: 30 },
  medium: { quality: 'medium', width: 854, height: 480, bitrate: 1_000_000, fps: 30 },
  low: { quality: 'low', width: 640, height: 360, bitrate: 500_000, fps: 24 },
};

const QUALITY_ORDER: ResolvedStreamQuality[] = ['low', 'medium', 'high'];

export async function getAutoResolvedQuality(): Promise<ResolvedStreamQuality> {
  try {
    const raw = await SecureStore.getItemAsync(AUTO_QUALITY_KEY);
    if (raw === 'high' || raw === 'medium' || raw === 'low') return raw;
  } catch {
    /* ignore */
  }
  return 'medium';
}

export async function saveAutoResolvedQuality(quality: ResolvedStreamQuality): Promise<void> {
  await SecureStore.setItemAsync(AUTO_QUALITY_KEY, quality);
}

export async function resolveEncoderQuality(setting: StreamQuality): Promise<ResolvedStreamQuality> {
  if (setting === 'auto') return getAutoResolvedQuality();
  return setting;
}

export function getEncoderPreset(quality: ResolvedStreamQuality): EncoderPreset {
  return ENCODER_PRESETS[quality];
}

function downgradeQuality(current: ResolvedStreamQuality): ResolvedStreamQuality {
  const idx = QUALITY_ORDER.indexOf(current);
  return idx > 0 ? QUALITY_ORDER[idx - 1] : current;
}

function upgradeQuality(current: ResolvedStreamQuality): ResolvedStreamQuality {
  const idx = QUALITY_ORDER.indexOf(current);
  return idx < QUALITY_ORDER.length - 1 ? QUALITY_ORDER[idx + 1] : current;
}

export async function adjustAutoQualityAfterStream(params: {
  videoFrames: number;
  durationSec: number;
  hadDisconnect: boolean;
  currentQuality: ResolvedStreamQuality;
}): Promise<void> {
  let next = params.currentQuality;
  const fps = params.durationSec > 0 ? params.videoFrames / params.durationSec : 0;

  if (params.hadDisconnect || (params.durationSec >= 20 && fps < 8)) {
    next = downgradeQuality(params.currentQuality);
  } else if (params.durationSec >= 60 && fps >= 25) {
    next = upgradeQuality(params.currentQuality);
  }

  if (next !== params.currentQuality) {
    await saveAutoResolvedQuality(next);
  }
}
