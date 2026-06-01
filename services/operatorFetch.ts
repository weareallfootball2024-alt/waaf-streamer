import { API_URL } from '../constants/api';

export type OperatorAuth = {
  sessionToken?: string | null;
  accessCode?: string | null;
  operatorToken?: string | null;
};

function buildHeaders(auth: OperatorAuth): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.sessionToken) headers.Authorization = `Bearer ${auth.sessionToken}`;
  if (auth.operatorToken) headers['X-Operator-Token'] = auth.operatorToken;
  return headers;
}

export function operatorFetch(
  path: string,
  auth: OperatorAuth,
  options: RequestInit = {},
): Promise<Response> {
  const headers = { ...buildHeaders(auth), ...(options.headers as Record<string, string> || {}) };
  let body = options.body;
  const method = options.method || 'GET';

  if (method !== 'GET' && body && typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      if (auth.accessCode) parsed.access_code = auth.accessCode;
      if (auth.operatorToken) parsed.operator_token = auth.operatorToken;
      body = JSON.stringify(parsed);
    } catch {
      /* keep body */
    }
  } else if (method !== 'GET' && !body && auth.accessCode) {
    body = JSON.stringify({ access_code: auth.accessCode });
  }

  return fetch(`${API_URL}${path}`, { ...options, headers, body });
}

export async function resolveOperatorToken(token: string): Promise<{ tournamentId: string }> {
  const res = await fetch(`${API_URL}/api/tournaments/by-token/${encodeURIComponent(token)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Ссылка недействительна');
  }
  return res.json();
}

export async function fetchTournamentMatches(tournamentId: string) {
  const res = await fetch(`${API_URL}/api/tournaments/${tournamentId}/matches`);
  if (!res.ok) throw new Error('Турнир не найден или нет матчей');
  return res.json();
}
