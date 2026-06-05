import { API_URL } from '../constants/api';

export type PublicClub = {
  id: number;
  name: string;
  city?: string;
  region?: string;
  logo_url?: string;
};

export type StandaloneMatchContext = {
  standalone: true;
  clubId?: number;
  clubName: string;
  clubLogoUri: string;
  teamHome: string;
  teamAway: string;
};

export function buildStandaloneMatch(ctx: StandaloneMatchContext) {
  return {
    standalone: true,
    id: 0,
    team_home: ctx.teamHome,
    team_away: ctx.teamAway,
    team_home_id: null,
    team_away_id: null,
    logo_home: ctx.clubLogoUri,
    logo_away: null,
    allow_stream: true,
    score_home: 0,
    score_away: 0,
    current_period: 0,
    sport_type: 'football',
    half_duration: 45,
    tournament_id: null,
  };
}

export async function searchPublicClubs(query: string): Promise<PublicClub[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetch(
    `${API_URL}/api/public/clubs?search=${encodeURIComponent(q)}`
  );
  if (!res.ok) throw new Error('Не удалось найти клубы');
  return res.json();
}
