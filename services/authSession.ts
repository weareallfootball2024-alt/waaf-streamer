import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../constants/api';
import type { StaffUser } from '../utils/roles';

const TOKEN_KEY = 'waaf_streamer_token';
const USER_KEY = 'waaf_streamer_user';

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveSession(token: string, user: StaffUser): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function getUser(): Promise<StaffUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? (JSON.parse(raw) as StaffUser) : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function login(phone: string, password: string): Promise<{
  ok: boolean;
  error?: string;
  user?: StaffUser;
}> {
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.token) {
      return { ok: false, error: data.error || 'Ошибка входа' };
    }
    await saveSession(data.token, data.user);
    return { ok: true, user: data.user };
  } catch {
    return { ok: false, error: 'Нет связи с сервером' };
  }
}

export async function restoreSession(): Promise<StaffUser | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      await clearSession();
      return null;
    }
    const data = await res.json();
    const user = (data.user || data) as StaffUser;
    if (user?.id) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      return user;
    }
  } catch {
    /* ignore */
  }
  await clearSession();
  return null;
}

export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...options, headers });
}
