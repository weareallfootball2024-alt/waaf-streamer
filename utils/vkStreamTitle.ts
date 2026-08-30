export function buildVkStreamTitle(opts: {
  tournamentName?: string | null;
  broadcastTitle?: string | null;
  teamHome?: string | null;
  teamAway?: string | null;
  isStandalone?: boolean;
}): string {
  const home = String(opts.teamHome ?? '').trim() || 'Хозяева';
  const away = String(opts.teamAway ?? '').trim() || 'Гости';
  const teams = `${home} — ${away}`;

  if (opts.isStandalone) {
    const prefix = String(opts.broadcastTitle ?? '').trim();
    if (prefix) return `${prefix}, ${teams}`.slice(0, 128);
    return teams.slice(0, 128);
  }

  const tour = String(opts.tournamentName ?? '').trim();
  if (tour) return `${tour}, ${teams}`.slice(0, 128);
  return teams.slice(0, 128);
}
