import * as SecureStore from 'expo-secure-store';

const VK_LIVE_SESSION_KEY = 'waaf_vk_live_session';

export type VkLiveSession = {
  groupId: number;
  videoId?: number;
  ownerId?: number;
  postId?: number;
  rtmpUrl?: string;
  streamKey?: string;
  embedUrl?: string;
  startedAt: number;
  apiStarted?: boolean;
};

export async function saveVkLiveSession(session: VkLiveSession): Promise<void> {
  await SecureStore.setItemAsync(VK_LIVE_SESSION_KEY, JSON.stringify(session));
}

export async function loadVkLiveSession(): Promise<VkLiveSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(VK_LIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VkLiveSession;
    if (!parsed?.groupId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearVkLiveSession(): Promise<void> {
  await SecureStore.deleteItemAsync(VK_LIVE_SESSION_KEY);
}
