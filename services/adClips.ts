import { Directory, File, Paths } from 'expo-file-system';
import type { AdClipPreset } from '../constants/streamPlatforms';

const MAX_CLIPS = 3;

function adClipsDir(): Directory {
  const dir = new Directory(Paths.document, 'ad-clips');
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

function guessExt(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
  const ext = match?.[1]?.toLowerCase();
  if (ext && ['mp4', 'mov', 'm4v', 'webm', 'mkv', '3gp'].includes(ext)) return ext;
  return 'mp4';
}

export function newAdClipId(): string {
  return `ad_${Date.now()}`;
}

/** Copy a gallery/content URI into app storage so Pedro/MediaCodec can open a real file. */
export async function copyAdClipToStorage(sourceUri: string, id: string): Promise<string> {
  const dir = adClipsDir();
  const dest = new File(dir, `${id}.${guessExt(sourceUri)}`);
  if (dest.exists) dest.delete();

  try {
    new File(sourceUri).copy(dest);
  } catch {
    const res = await fetch(sourceUri);
    if (!res.ok) {
      throw new Error('Не удалось прочитать видеофайл');
    }
    dest.create();
    dest.write(new Uint8Array(await res.arrayBuffer()));
  }
  if (!dest.exists) {
    throw new Error('Файл ролика не записался');
  }
  return dest.uri;
}

export function trimAdClips(clips: AdClipPreset[]): AdClipPreset[] {
  return clips.slice(0, MAX_CLIPS);
}

export { MAX_CLIPS };
