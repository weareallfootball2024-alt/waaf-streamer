import { API_URL } from '../constants/api';

export type GuestLiveResponse = {
  match: Record<string, unknown> & {
    id: number;
    team_home: string;
    team_away: string;
    guest?: boolean;
    freemium?: boolean;
    allow_stream: number;
    score_home: number;
    score_away: number;
    sport_type: string;
    half_duration: number;
    current_period: number;
  };
  sessionToken: string;
  accessCode: string;
};

export async function createGuestLiveMatch(teamHome: string, teamAway: string): Promise<GuestLiveResponse> {
  const res = await fetch(`${API_URL}/api/matches/guest-live`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team_home: teamHome, team_away: teamAway }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось создать матч');
  }
  return data;
}
