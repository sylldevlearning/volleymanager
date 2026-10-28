/** The setup grid shows 0–20 first; "+" unrolls up to 99 */
export const COMPACT_MAX_NUMBER = 20;
const MAX_NUMBER = 99;

export function jerseyNumbers(expanded: boolean): number[] {
  const last = expanded ? MAX_NUMBER : COMPACT_MAX_NUMBER;
  return Array.from({ length: last + 1 }, (_, n) => n);
}
