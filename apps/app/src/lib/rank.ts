/**
 * Fractional indexing for `ContentItem.position`.
 *
 * Ranks compare with plain string ordering, so a card moves between two
 * neighbours by minting a key that sorts between them — one row written
 * instead of renumbering the column.
 *
 * A key is read as the digits after an implicit "0.", i.e. "a0" is the base-36
 * fraction 0.a0. `null` on the left means 0, `null` on the right means 1, so
 * prepend, append and insert are all the same midpoint operation.
 */

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz"

/**
 * A key that sorts strictly between `before` and `after`.
 *
 * Pass `null` for an open end: `rankBetween(null, first)` prepends,
 * `rankBetween(last, null)` appends, `rankBetween(null, null)` seeds an
 * empty column.
 */
export function rankBetween(before: string | null, after: string | null): string {
  const lo = before ?? ""

  if (after !== null && lo >= after) {
    throw new Error(`rankBetween: "${before}" must sort before "${after}"`)
  }

  return midpoint(lo, after)
}

function midpoint(lo: string, hi: string | null): string {
  if (hi !== null) {
    // Copy the shared prefix and recurse on what's left. Digits past the end
    // of `lo` read as "0", since a shorter key is the same fraction padded.
    let shared = 0
    while ((lo[shared] ?? "0") === hi[shared]) shared += 1
    if (shared > 0) {
      return hi.slice(0, shared) + midpoint(lo.slice(shared), hi.slice(shared))
    }
  }

  const loDigit = lo === "" ? 0 : DIGITS.indexOf(lo.charAt(0))
  const hiDigit = hi === null ? DIGITS.length : DIGITS.indexOf(hi.charAt(0))

  if (hiDigit - loDigit > 1) {
    // Room at this position: take the midpoint digit and stop.
    return DIGITS.charAt(Math.round((loDigit + hiDigit) / 2))
  }

  // Adjacent digits. If `hi` continues past its first digit there is space
  // under that digit, so descend into it.
  if (hi !== null && hi.length > 1) return hi.slice(0, 1)

  // Otherwise the gap is under `lo`'s digit, which is unbounded above.
  return DIGITS.charAt(loDigit) + midpoint(lo.slice(1), null)
}
