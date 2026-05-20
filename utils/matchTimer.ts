export function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

export function getActualSeconds(
  timerBase: number,
  timerUpdatedAt: number | null,
  isRunning: boolean,
  direction: string
): number {
  const base = Number(timerBase) || 0;
  if (!isRunning || !timerUpdatedAt) return base;
  const elapsedSec = (Date.now() - Number(timerUpdatedAt)) / 1000;
  if (direction === 'down') return Math.max(0, base - elapsedSec);
  return base + elapsedSec;
}
