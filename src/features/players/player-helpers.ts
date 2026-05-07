type NameSource = { firstName?: string | null; lastName?: string | null; number: number };

export function getPlayerDisplayName(p: NameSource): string {
  const first = (p.firstName ?? '').trim();
  const last = (p.lastName ?? '').trim();
  if (first && last) return `${first} ${last}`;
  if (last) return last;
  if (first) return first;
  return `#${p.number}`;
}

export function getPlayerShortName(p: NameSource): string {
  const last = (p.lastName ?? '').trim();
  const first = (p.firstName ?? '').trim();
  if (last) return last;
  if (first) return first;
  return `#${p.number}`;
}
