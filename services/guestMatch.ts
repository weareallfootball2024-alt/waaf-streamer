import { API_URL } from '../constants/api';

export type GuestLivePayload = {
  teamHome: string;
  teamAway: string;
  clubId?: number;
  awayClubId?: number;
  clubLogoUri?: string;
  awayLogoUri?: string;
};

export type GuestLiveResponse = {
  match: Record<string, unknown> & {
    id: number;
    team_home: string;
    team_away: string;
    logo_home?: string | null;
    logo_away?: string | null;
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

export async function createGuestLiveMatch(payload: GuestLivePayload): Promise<GuestLiveResponse> {
  const res = await fetch(`${API_URL}/api/matches/guest-live`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      team_home: payload.teamHome,
      team_away: payload.teamAway,
      club_id: payload.clubId,
      away_club_id: payload.awayClubId,
      club_logo_url: payload.clubLogoUri || undefined,
      away_logo_url: payload.awayLogoUri || undefined,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось создать матч');
  }
  return data;
}
