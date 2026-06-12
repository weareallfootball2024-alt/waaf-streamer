export type VkStreamTarget = 'wall' | 'playlist';

export type StreamPlatform = 'vk' | 'youtube' | 'rutube' | 'waaf';

export type StreamQuality = 'high' | 'medium' | 'low' | 'auto';

export const STREAM_QUALITY_LABELS: Record<StreamQuality, string> = {
  high: 'Высокое',
  medium: 'Среднее',
  low: 'Низкое',
  auto: 'Авто',
};

export const STREAM_QUALITY_HINTS: Record<StreamQuality, string> = {
  high: '1280×720 · 1,5 Мбит/с',
  medium: '854×480 · 1,0 Мбит/с',
  low: '640×360 · 0,5 Мбит/с',
  auto: 'Подстраивается под интернет',
};

export type PlatformConfig = {
  enabled: boolean;
  rtmpUrl: string;
  streamKey: string;
  embedUrl?: string;
};

export type VkPlatformConfig = PlatformConfig & {
  streamTarget: VkStreamTarget;
  communityId?: number;
  communityName?: string;
  communityPhoto?: string;
  albumId?: number;
  albumTitle?: string;
};

export type StreamSettings = {
  activePlatform: StreamPlatform;
  streamQuality: StreamQuality;
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
  streamQuality: 'auto',
  vk: {
    ...emptyPlatform(true),
    streamTarget: 'wall',
    communityId: undefined,
    communityName: undefined,
  },
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
