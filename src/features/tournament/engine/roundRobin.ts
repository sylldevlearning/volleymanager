export interface Pairing {
  round: number;
  home: string;
  away: string;
}

/**
 * Berger tables (circle method): every pair once per leg, nobody twice in a
 * round, an odd count adds a bye. Home and away alternate.
 */
export function roundRobin(ids: readonly string[], legs: 1 | 2): Pairing[] {
  const list: (string | null)[] = [...ids];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds = n - 1;
  const firstLeg: Pairing[] = [];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a === null || b === null) continue;
      // The fixed team alternates home/away; the others by table position
      const swap = i === 0 ? r % 2 === 1 : i % 2 === 1;
      firstLeg.push({ round: r + 1, home: swap ? b : a, away: swap ? a : b });
    }
    list.splice(1, 0, list.pop()!);
  }
  if (legs === 1) return firstLeg;
  return [...firstLeg, ...firstLeg.map((p) => ({ round: p.round + rounds, home: p.away, away: p.home }))];
}
