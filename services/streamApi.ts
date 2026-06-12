import { API_URL } from '../constants/api';
import { authFetch, getToken } from './authSession';
import { getStoredVkUserId } from './vkAuth';

export type StreamAccess = {
  can_stream_standalone: boolean;
  standalone_match_price_rub: number;
  needs_auth?: boolean;
  needs_waaf_login?: boolean;
  needs_payment?: boolean;
  is_superadmin?: boolean;
  free_reason?: string;
  reason?: string;
  payment_id?: number;
  suggest_tournament?: boolean;
  tournament_hint?: string;
  identity_mode?: 'waaf' | 'vk';
};

export async function buildStreamIdentityHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const vkUserId = await getStoredVkUserId();
  if (vkUserId) headers['X-VK-User-Id'] = vkUserId;
  return headers;
}

export async function fetchStreamAccess(): Promise<StreamAccess> {
  const headers = await buildStreamIdentityHeaders();
  delete headers['Content-Type'];
  const res = await fetch(`${API_URL}/api/stream/access`, { headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось проверить доступ к трансляции');
  }
  return data as StreamAccess;
}

export async function initStandalonePayment(): Promise<{
  payment_id: number;
  paymentUrl: string;
  amount_rub: number;
}> {
  const headers = await buildStreamIdentityHeaders();
  const res = await fetch(`${API_URL}/api/stream/pay/init`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось начать оплату');
  }
  return data;
}

export async function fetchPaymentStatus(paymentId: number): Promise<{
  id: number;
  status: string;
  amount_rub: number;
}> {
  const headers = await buildStreamIdentityHeaders();
  delete headers['Content-Type'];
  const res = await fetch(`${API_URL}/api/stream/payment/${paymentId}`, { headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось проверить оплату');
  }
  return data;
}

export async function linkWaafAccount(phone: string, password: string, vkUserId: string) {
  const res = await fetch(`${API_URL}/api/stream/link-waaf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password, vk_user_id: vkUserId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось привязать аккаунт');
  }
  return data as { token: string; user: Record<string, unknown> };
}

export async function streamAuthFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = await buildStreamIdentityHeaders();
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });
}

export { authFetch };
