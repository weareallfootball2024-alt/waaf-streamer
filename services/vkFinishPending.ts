import * as SecureStore from 'expo-secure-store';

const VK_FINISH_PENDING_KEY = 'waaf_vk_finish_pending';

export type VkFinishPending = {
  groupId: number;
  videoId?: number;
  embedUrl?: string;
  failedAt: number;
  lastError?: string;
};

export async function saveVkFinishPending(pending: VkFinishPending): Promise<void> {
  await SecureStore.setItemAsync(VK_FINISH_PENDING_KEY, JSON.stringify(pending));
}

export async function loadVkFinishPending(): Promise<VkFinishPending | null> {
  try {
    const raw = await SecureStore.getItemAsync(VK_FINISH_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VkFinishPending;
    if (!parsed?.groupId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearVkFinishPending(): Promise<void> {
  await SecureStore.deleteItemAsync(VK_FINISH_PENDING_KEY);
}
