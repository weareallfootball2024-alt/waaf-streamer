import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import { API_URL } from '../constants/api';

WebBrowser.maybeCompleteAuthSession();

const VK_TOKEN_KEY = 'vk_access_token';
const APP_OAUTH_RETURN = Linking.createURL('oauth/vk');

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

export async function clearVkToken(): Promise<void> {
  await SecureStore.deleteItemAsync(VK_TOKEN_KEY);
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
