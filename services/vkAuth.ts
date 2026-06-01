import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

import { API_URL } from '../constants/api';

WebBrowser.maybeCompleteAuthSession();

const VK_DEVICE_ID_KEY = 'vk_device_id';
const VK_TOKEN_KEY = 'vk_access_token';

export type VkGroup = {
  id: number;
  name: string;
  photo: string | null;
};

export function getVkRedirectUri(): string {
  return makeRedirectUri({ scheme: 'waafstreamer', path: 'oauth/vk' });
}

async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await SecureStore.getItemAsync(VK_DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `waaf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await SecureStore.setItemAsync(VK_DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export async function getStoredVkToken(): Promise<string | null> {
  return SecureStore.getItemAsync(VK_TOKEN_KEY);
}

export async function clearVkToken(): Promise<void> {
  await SecureStore.deleteItemAsync(VK_TOKEN_KEY);
}

export async function loginWithVk(): Promise<string> {
  const vkAppId = process.env.EXPO_PUBLIC_VK_APP_ID;
  if (!vkAppId) {
    throw new Error('VK не настроен. Задайте EXPO_PUBLIC_VK_APP_ID');
  }

  const deviceId = await getOrCreateDeviceId();
  const redirectUri = getVkRedirectUri();
  const authUrl =
    `https://id.vk.com/authorize?client_id=${encodeURIComponent(vkAppId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&scope=${encodeURIComponent('groups')}` +
    `&state=waaf&device_id=${encodeURIComponent(deviceId)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  if (result.type !== 'success' || !result.url) {
    throw new Error('VK авторизация отменена');
  }

  const parsed = Linking.parse(result.url);
  const code = parsed.queryParams?.code;
  if (!code || Array.isArray(code)) {
    throw new Error('VK не вернул код авторизации');
  }

  const exchangeRes = await fetch(`${API_URL}/api/auth/vk-id/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: String(code),
      redirect_uri: redirectUri,
      device_id: deviceId,
    }),
  });
  const data = await exchangeRes.json();
  if (!exchangeRes.ok) {
    throw new Error(data.error || 'Ошибка обмена VK-токена');
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
