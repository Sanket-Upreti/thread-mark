// Shared by the transcript and the digest header. Kept apart from both so neither has to
// import the other.

export function formatAbsolute(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

/** A span as a short delta: `<1m`, `45m`, `2h 18m`, `3d 4h`. */
export function relativeDelta(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return '<1m';

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes && !days) parts.push(`${minutes}m`);

  // Always non-empty: totalMinutes >= 1 here, so at least one component was pushed.
  return parts.join(' ');
}
