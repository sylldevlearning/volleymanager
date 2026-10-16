export interface CaptainStatusInput {
  /** The team's permanently registered captain (set at match creation), or null for legacy matches. */
  registeredCaptainId: string | null;
  /** The manually-designated stand-in captain while the registered captain is off court. */
  actingCaptainId: string | null;
  onCourtPlayerIds: string[];
}

/**
 * Which player should be marked as captain on court right now: the
 * registered captain whenever they're on court, otherwise the acting
 * (stand-in) captain. Returns null if neither is currently on court.
 */
export function getDisplayedCaptainId(input: CaptainStatusInput): string | null {
  const { registeredCaptainId, actingCaptainId, onCourtPlayerIds } = input;
  if (registeredCaptainId && onCourtPlayerIds.includes(registeredCaptainId)) {
    return registeredCaptainId;
  }
  return actingCaptainId;
}

/**
 * True when the registered captain is off court AND there's no valid acting
 * captain currently on court either — the referee must pick a new one.
 * False whenever the registered captain is back on court (they resume
 * automatically, no picker needed) or an acting captain is already in place.
 */
export function needsNewActingCaptain(input: CaptainStatusInput): boolean {
  const { registeredCaptainId, actingCaptainId, onCourtPlayerIds } = input;
  if (!registeredCaptainId) return false;
  if (onCourtPlayerIds.includes(registeredCaptainId)) return false;
  return !actingCaptainId || !onCourtPlayerIds.includes(actingCaptainId);
}
