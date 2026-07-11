import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import { API_URL } from '../constants/api';

WebBrowser.maybeCompleteAuthSession();

const VK_TOKEN_KEY = 'vk_access_token';
const VK_USER_ID_KEY = 'vk_user_id';
const VK_CAPABILITIES_KEY = 'vk_capabilities_cache';
const APP_OAUTH_RETURN = Linking.createURL('oauth/vk');

export type VkCapabilities = {
  groups: boolean;
  video: boolean;
  oauth_scope_requested?: string;
  errors?: { groups?: string | null; video?: string | null };
  checkedAt?: number;
};

export type VkGroup = {
  id: number;
  name: string;
  photo: string | null;
};

export type VkAlbum = {
  id: number;
  title: string;
};

export async function getStoredVkToken(): Promise<string | null> {
  return SecureStore.getItemAsync(VK_TOKEN_KEY);
}

export async function getStoredVkUserId(): Promise<string | null> {
  return SecureStore.getItemAsync(VK_USER_ID_KEY);
}

export async function clearVkToken(): Promise<void> {
  await SecureStore.deleteItemAsync(VK_TOKEN_KEY);
  await SecureStore.deleteItemAsync(VK_USER_ID_KEY);
  await SecureStore.deleteItemAsync(VK_CAPABILITIES_KEY);
}

export async function getStoredVkCapabilities(): Promise<VkCapabilities | null> {
  try {
    const raw = await SecureStore.getItemAsync(VK_CAPABILITIES_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VkCapabilities;
  } catch {
    return null;
  }
}

export async function fetchAndStoreVkCapabilities(groupId?: number): Promise<VkCapabilities | null> {
  const token = await getStoredVkToken();
  if (!token) return null;
  try {
    const qs = groupId ? new URLSearchParams({ group_id: String(groupId) }) : new URLSearchParams();
    const url = `${API_URL}/api/vk/capabilities${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await fetch(url, { headers: { 'X-VK-Access-Token': token } });
    const data = await res.json();
    if (!res.ok) return null;
    const caps: VkCapabilities = {
      groups: !!data.groups,
      video: !!data.video,
      oauth_scope_requested: data.oauth_scope_requested,
      errors: data.errors,
      checkedAt: Date.now(),
    };
    await SecureStore.setItemAsync(VK_CAPABILITIES_KEY, JSON.stringify(caps));
    return caps;
  } catch {
    return null;
  }
}

function parseAuthResultUrl(url: string) {
  const parsed = Linking.parse(url);
  const params = parsed.queryParams || {};
  const pick = (key: string): string | null => {
    const v = params[key];
    if (!v) return null;
    return Array.isArray(v) ? v[0] : String(v);
  };
  return {
    session: pick('session'),
    error: pick('error'),
    errorDescription: pick('error_description'),
  };
}

function authSessionErrorMessage(result: WebBrowser.WebBrowserAuthSessionResult): string {
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return `VK: страница не загрузилась или вход прерван (${result.type})`;
  }
  if (result.type === 'success' && result.url) {
    const { error, errorDescription } = parseAuthResultUrl(result.url);
    if (error) {
      return errorDescription || `VK: ${error}`;
    }
  }
  return `VK не вернул авторизацию (${result.type})`;
}

export async function fetchAndStoreVkUserId(accessToken?: string): Promise<string | null> {
  const existing = await getStoredVkUserId();
  if (existing) return existing;

  const token = accessToken || (await getStoredVkToken());
  if (!token) return null;

  const res = await fetch(`${API_URL}/api/vk/users/me`, {
    headers: { 'X-VK-Access-Token': token },
  });
  const data = await res.json();
  if (!res.ok || data.user_id == null) return null;

  const id = String(data.user_id);
  await SecureStore.setItemAsync(VK_USER_ID_KEY, id);
  return id;
}

export async function ensureStoredVkUserId(): Promise<string | null> {
  return fetchAndStoreVkUserId();
}

export async function loginWithVk(): Promise<string> {
  const startUrl = `${API_URL}/api/auth/vk-id/start`;

  const result = await WebBrowser.openAuthSessionAsync(startUrl, APP_OAUTH_RETURN);
  if (result.type !== 'success' || !result.url) {
    throw new Error(authSessionErrorMessage(result));
  }

  const { session, error, errorDescription } = parseAuthResultUrl(result.url);
  if (error) {
    throw new Error(errorDescription || `VK: ${error}`);
  }
  if (!session) {
    throw new Error('VK не вернул сессию авторизации');
  }

  const completeRes = await fetch(`${API_URL}/api/auth/vk-id/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session }),
  });
  const data = await completeRes.json();
  if (!completeRes.ok) {
    throw new Error(data.error || 'Ошибка завершения VK авторизации');
  }

  await SecureStore.setItemAsync(VK_TOKEN_KEY, data.access_token);
  if (data.user_id != null) {
    await SecureStore.setItemAsync(VK_USER_ID_KEY, String(data.user_id));
  } else {
    await fetchAndStoreVkUserId(data.access_token);
  }
  await fetchAndStoreVkCapabilities();
  return data.access_token;
}

export async function fetchAdminGroups(accessToken?: string): Promise<VkGroup[]> {
  const token = accessToken || (await getStoredVkToken());
  if (!token) throw new Error('Сначала войдите через VK');

  const res = await fetch(`${API_URL}/api/vk/groups/admin`, {
    headers: { 'X-VK-Access-Token': token },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Не удалось загрузить сообщества');
  return data.groups || [];
}

export async function fetchGroupAlbums(groupId: number, accessToken?: string): Promise<VkAlbum[]> {
  const token = accessToken || (await getStoredVkToken());
  if (!token) throw new Error('Сначала войдите через VK');

  const res = await fetch(`${API_URL}/api/vk/groups/${groupId}/albums`, {
    headers: { 'X-VK-Access-Token': token },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Не удалось загрузить плейлисты');
  return data.albums || [];
}

export async function resolveCommunity(input: string, accessToken?: string): Promise<VkGroup> {
  const token = accessToken || (await getStoredVkToken());
  const headers: Record<string, string> = {};
  if (token) headers['X-VK-Access-Token'] = token;

  const qs = new URLSearchParams({ input: input.trim() });
  const res = await fetch(`${API_URL}/api/vk/groups/resolve?${qs.toString()}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Не удалось найти сообщество');
  if (!data.group) throw new Error('Сообщество не найдено');
  return data.group;
}

export function parseVkVideoRef(
  input?: string | null,
): { groupId: number; videoId: number } | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const m = raw.match(/video(-?\d+)_(\d+)/i);
  if (!m) return null;
  const owner = parseInt(m[1], 10);
  const videoId = parseInt(m[2], 10);
  if (!Number.isFinite(owner) || !Number.isFinite(videoId)) return null;
  const groupId = owner < 0 ? Math.abs(owner) : owner;
  return { groupId, videoId };
}

export async function stopVkLiveBroadcast(opts: {
  groupId?: number;
  videoId?: number;
  embedUrl?: string;
}): Promise<{ ok: boolean; videoId?: number; error?: string }> {
  const token = await getStoredVkToken();
  if (!token) return { ok: false, error: 'no_vk_token' };

  let groupId = opts.groupId;
  let videoId = opts.videoId;
  if ((!groupId || !videoId) && opts.embedUrl) {
    const parsed = parseVkVideoRef(opts.embedUrl);
    if (parsed) {
      groupId = groupId || parsed.groupId;
      videoId = videoId || parsed.videoId;
    }
  }
  if (!groupId) return { ok: false, error: 'no_group_id' };

  try {
    const res = await fetch(`${API_URL}/api/vk/stream/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VK-Access-Token': token,
      },
      body: JSON.stringify({
        group_id: groupId,
        video_id: videoId || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'vk_stop_failed' };
    }
    return { ok: true, videoId: data.video_id };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

export async function fetchActiveVkLive(
  groupId: number,
): Promise<{ videoId: number; ownerId: number; embedUrl: string } | null> {
  const token = await getStoredVkToken();
  if (!token || !groupId) return null;
  try {
    const qs = new URLSearchParams({ group_id: String(groupId) });
    const res = await fetch(`${API_URL}/api/vk/stream/active?${qs.toString()}`, {
      headers: { 'X-VK-Access-Token': token },
    });
    const data = await res.json();
    if (!res.ok || !data.active || data.video_id == null) return null;
    const ownerId = data.owner_id != null ? Number(data.owner_id) : -groupId;
    const embedUrl = data.embed_url || `https://vk.com/video${ownerId}_${data.video_id}`;
    return { videoId: Number(data.video_id), ownerId, embedUrl };
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** После появления RTMP-сигнала VK создаёт объект трансляции — ищем с паузами. */
export async function resolveActiveVkLiveWithRetry(
  groupId: number,
  opts: { attempts?: number; delayMs?: number } = {},
): Promise<{ videoId: number; ownerId: number; embedUrl: string } | null> {
  const attempts = opts.attempts ?? 12;
  const delayMs = opts.delayMs ?? 4000;
  for (let i = 0; i < attempts; i++) {
    const active = await fetchActiveVkLive(groupId);
    if (active) return active;
    if (i < attempts - 1) await sleep(delayMs);
  }
  return null;
}

export type VkLiveStartResult = {
  ok: boolean;
  rtmpUrl?: string;
  streamKey?: string;
  videoId?: number;
  ownerId?: number;
  postId?: number;
  error?: string;
};

/** Как SportCam/stream.vi: создаёт трансляцию в VK, отдаёт RTMP + video_id для stopStreaming. */
export async function startVkLiveBroadcast(opts: {
  groupId: number;
  name?: string;
  wallpost?: boolean;
}): Promise<VkLiveStartResult> {
  const token = await getStoredVkToken();
  if (!token) return { ok: false, error: 'no_vk_token' };
  if (!opts.groupId) return { ok: false, error: 'no_group_id' };

  try {
    const res = await fetch(`${API_URL}/api/vk/stream/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VK-Access-Token': token,
      },
      body: JSON.stringify({
        group_id: opts.groupId,
        name: opts.name || 'WAAF Live',
        wallpost: !!opts.wallpost,
        publish: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'vk_start_failed' };
    }
    const rtmpUrl = String(data.rtmp_url || '').trim();
    const streamKey = String(data.stream_key || '').trim();
    if (!rtmpUrl || !streamKey) {
      return { ok: false, error: 'vk_no_rtmp' };
    }
    return {
      ok: true,
      rtmpUrl,
      streamKey,
      videoId: data.video_id != null ? Number(data.video_id) : undefined,
      ownerId: data.owner_id != null ? Number(data.owner_id) : undefined,
      postId: data.post_id != null ? Number(data.post_id) : undefined,
    };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

export function vkStreamErrorMessage(error?: string): string {
  const raw = String(error || '').trim();
  if (!raw) return 'Неизвестная ошибка VK API';

  switch (raw) {
    case 'no_vk_token':
      return 'Войдите через VK в настройках трансляции.';
    case 'no_group_id':
      return 'Выберите сообщество VK.';
    case 'network_error':
      return 'Нет связи с сервером WAAF.';
    case 'vk_no_rtmp':
      return 'VK не выдал RTMP. Нужен scope video у приложения 54534524 (devsupport@corp.vk.com).';
    case 'vk_stop_failed':
      return 'VK API не завершил трансляцию. Завершите в Studio вручную.';
    default:
      break;
  }

  const lower = raw.toLowerCase();
  if (lower.includes('активная трансляция') && lower.includes('не найдена')) {
    return 'Эфир идёт, но VK API не видит объект трансляции (нет scope video или эфир ещё не зарегистрирован). Подождите 30 сек или завершите в Studio вручную.';
  }
  if (
    lower.includes('access denied') ||
    lower.includes('доступ запрещён') ||
    lower.includes('profile type') ||
    lower.includes('scope video') ||
    raw.includes('error_code":15') ||
    raw.includes('error_code":204')
  ) {
    return 'VK не одобрил scope video для приложения 54534524. Завершите в Studio вручную. Запрос: devsupport@corp.vk.com';
  }
  return raw;
}

/** Сообщение для алерта после СТОП */
export function vkStopBroadcastMessage(opts: {
  ok: boolean;
  error?: string;
}): string {
  if (opts.ok) {
    return 'Трансляция в VK Studio завершена.';
  }
  if (opts.error === 'no_vk_token') {
    return 'RTMP отключён. Для авто-завершения войдите через VK и выберите сообщество. Сейчас завершите в Studio вручную.';
  }
  return `RTMP отключён. ${vkStreamErrorMessage(opts.error)}`;
}
