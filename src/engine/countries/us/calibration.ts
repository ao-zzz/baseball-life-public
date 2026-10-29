// Intercepts of the US checks, written by scripts/calibrate-us.ts (300000 lives a round, 3 rounds; a key missing here uses the first guess,
// exact for a standard normal ability). The targets they reproduce are game assumptions (stats.ts `us*`), not statistics.
export const US_ALPHA: Record<string, number> = {
  'us.mid': 0.034,
  'us.hs': 0.324,
  'us.hsStay': 1.03,
  'us.hsDraft': -5.498,
  'us.hsSign': -1.243,
  'us.hsCollege': -1.966,
  'us.collegeStay': 0.88,
  'us.collegeDraft': -4.877,
  'us.collegeSign': 0.371,
  'us.jucoTransfer': -0.161,
  'us.minorUp': -2.435,
  'us.minorExit': 0.881,
  'us.mlbDebut': -3.545,
  'us.mlbExit': 0.314,
}
