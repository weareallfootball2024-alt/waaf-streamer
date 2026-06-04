import { authFetch } from './authSession';

export type SkillTestType = {
  id: number;
  slug: string;
  title: string;
  description?: string;
  instruction_json?: { steps?: string[] };
  max_duration_sec: number;
};

export type ClubItem = {
  id: number;
  name: string;
  city?: string;
  logo_url?: string;
  role?: string;
};

export type PlayerItem = {
  id: number;
  name: string;
  dob?: string;
  photo_url?: string;
  rating?: number;
};

export async function fetchTestTypes(): Promise<SkillTestType[]> {
  const res = await authFetch('/api/skill-tests/types');
  if (!res.ok) throw new Error('Не удалось загрузить тесты');
  return res.json();
}

export async function fetchClubs(): Promise<ClubItem[]> {
  const res = await authFetch('/api/skill-tests/clubs');
  if (!res.ok) throw new Error('Не удалось загрузить клубы');
  return res.json();
}

export async function fetchClubPlayers(clubId: number): Promise<PlayerItem[]> {
  const res = await authFetch(`/api/skill-tests/clubs/${clubId}/players`);
  if (!res.ok) throw new Error('Не удалось загрузить игроков');
  return res.json();
}

export async function createAttempt(
  clubId: number,
  playerId: number,
  testTypeId: number
): Promise<number> {
  const res = await authFetch('/api/skill-tests/attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      club_id: clubId,
      player_id: playerId,
      test_type_id: testTypeId,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Не удалось создать попытку');
  return data.attempt_id;
}

export async function uploadAttemptVideo(
  attemptId: number,
  uri: string
): Promise<{ status: string; confidence?: number }> {
  const form = new FormData();
  form.append('video', {
    uri,
    name: `attempt_${attemptId}.mp4`,
    type: 'video/mp4',
  } as unknown as Blob);

  const res = await authFetch(`/api/skill-tests/attempts/${attemptId}/video`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка загрузки видео');
  return data;
}
