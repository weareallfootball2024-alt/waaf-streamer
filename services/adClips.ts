import * as FileSystem from 'expo-file-system';
import type { AdClipPreset } from '../constants/streamPlatforms';

const AD_DIR = `${FileSystem.documentDirectory ?? ''}ad-clips/`;
const MAX_CLIPS = 3;

export function newAdClipId(): string {
  return `ad_${Date.now()}`;
}

export async function copyAdClipToStorage(sourceUri: string, id: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(AD_DIR, { intermediates: true });
  const extMatch = sourceUri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  const ext = extMatch?.[1]?.toLowerCase() || 'mp4';
  const dest = `${AD_DIR}${id}.${ext}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export function trimAdClips(clips: AdClipPreset[]): AdClipPreset[] {
  return clips.slice(0, MAX_CLIPS);
}

export { MAX_CLIPS };
