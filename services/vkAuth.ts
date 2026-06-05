import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import { API_URL } from '../constants/api';
import { generateCodeChallenge, generateRandomString } from '../utils/vkPkce';

WebBrowser.maybeCompleteAuthSession();

const VK_TOKEN_KEY = 'vk_access_token';
const VK_AUTH_HOST = 'https://id.vk.ru';

export type VkGroup = {
  id: number;
  name: string;
  photo: string | null;
};

function requireVkAppId(): string {
  const vkAppId = process.env.EXPO_PUBLIC_VK_APP_ID;
  if (!vkAppId) {
    throw new Error('VK не настроен. Задайте EXPO_PUBLIC_VK_APP_ID');
  }
  return vkAppId;
}

/** Формат redirect URI для VK ID (мобильное OAuth). Должен совпадать с кабинетом VK ID. */
export function getVkRedirectUri(): string {
  return `vk${requireVkAppId()}://vk.ru/blank.html`;
}

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
    code: pick('code'),
    deviceId: pick('device_id'),
    state: pick('state'),
    error: pick('error'),
    errorDescription: pick('error_description'),
  };
}

function authSessionErrorMessage(
  result: WebBrowser.WebBrowserAuthSessionResult,
  redirectUri: string
): string {
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return 'VK авторизация отменена';
  }
  if (result.type === 'success' && result.url) {
    const { error, errorDescription } = parseAuthResultUrl(result.url);
    if (error) {
      return errorDescription || `VK: ${error}`;
    }
  }
  return `VK не вернул авторизацию. Проверьте redirect URI в кабинете VK ID: ${redirectUri}`;
}

export async function loginWithVk(): Promise<string> {
  const vkAppId = requireVkAppId();
  const redirectUri = getVkRedirectUri();
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(48);

  const authUrl =
    `${VK_AUTH_HOST}/authorize?response_type=code` +
    `&client_id=${encodeURIComponent(vkAppId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  if (result.type !== 'success' || !result.url) {
    throw new Error(authSessionErrorMessage(result, redirectUri));
  }

  const { code, deviceId, state: returnedState, error, errorDescription } =
    parseAuthResultUrl(result.url);

  if (error) {
    throw new Error(errorDescription || `VK: ${error}`);
  }
  if (!code) {
    throw new Error('VK не вернул код авторизации');
  }
  if (!deviceId) {
    throw new Error('VK не вернул device_id');
  }
  if (returnedState !== state) {
    throw new Error('VK: несовпадение state (возможная подмена ответа)');
  }

  const exchangeRes = await fetch(`${API_URL}/api/auth/vk-id/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      device_id: deviceId,
      state,
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
