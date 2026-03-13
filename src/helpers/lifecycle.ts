/**
 * TAGITCore lifecycle state label mapping
 * Maps uint8 state enum to human-readable labels.
 *
 * enum State { NONE=0, MINTED=1, BOUND=2, ACTIVATED=3, CLAIMED=4, FLAGGED=5, RECYCLED=6 }
 */
export function lifecycleStateLabel(state: i32): string {
  if (state == 0) return "NONE";
  if (state == 1) return "MINTED";
  if (state == 2) return "BOUND";
  if (state == 3) return "ACTIVATED";
  if (state == 4) return "CLAIMED";
  if (state == 5) return "FLAGGED";
  if (state == 6) return "RECYCLED";
  return "UNKNOWN";
}
