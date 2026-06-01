export type StreamPlatform = 'vk' | 'youtube' | 'rutube' | 'waaf';

export type PlatformConfig = {
  enabled: boolean;
  rtmpUrl: string;
  streamKey: string;
  embedUrl?: string;
};

export type VkPlatformConfig = PlatformConfig & {
  communityId?: number;
  communityName?: string;
  communityPhoto?: string;
};

export type StreamSettings = {
  activePlatform: StreamPlatform;
  vk: VkPlatformConfig;
  youtube: PlatformConfig;
  rutube: PlatformConfig;
  waaf: PlatformConfig;
};

export const PLATFORM_LABELS: Record<StreamPlatform, string> = {
  vk: 'VK Live',
  youtube: 'YouTube',
  rutube: 'Rutube',
  waaf: 'WAAF (сайт)',
};

export const STUB_PLATFORMS: StreamPlatform[] = ['youtube', 'rutube', 'waaf'];

const emptyPlatform = (enabled: boolean): PlatformConfig => ({
  enabled,
  rtmpUrl: '',
  streamKey: '',
  embedUrl: '',
});

export const DEFAULT_STREAM_SETTINGS: StreamSettings = {
  activePlatform: 'vk',
  vk: { ...emptyPlatform(true), communityId: undefined, communityName: undefined },
  youtube: emptyPlatform(false),
  rutube: emptyPlatform(false),
  waaf: emptyPlatform(false),
};

export function parseOperatorToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.includes('token=')) {
      const url = trimmed.startsWith('http') ? new URL(trimmed) : new URL(trimmed, 'https://local');
      const token = url.searchParams.get('token');
      if (token) return token;
    }
  } catch {
    /* plain token */
  }
  if (/^[a-f0-9]{32,64}$/i.test(trimmed)) return trimmed;
  return trimmed.length >= 16 ? trimmed : null;
}
