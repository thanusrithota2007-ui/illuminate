// Pure, framework-free similarity calculation for the SYNTHETIC "You are not alone" demonstration.
// Rule (mirrors the SQL function public.demo_similarity):
//   denominator = demo profiles with eligible === true (consent-style flag)
//   a profile matches when it reported at least one of the selected topics
//   percent     = matching / denominator * 100 (one decimal place)
// It uses no photo, face, YouCam score or biometric data of any kind.
export function computeSimilarity(profiles, slugs) {
  const wanted = new Set(slugs);
  const eligible = profiles.filter(p => p.eligible);
  const flags = eligible.map(p => p.categories.some(c => wanted.has(c)));
  const matching = flags.filter(Boolean).length, total = eligible.length;
  return { eligibleTotal: total, matching, percent: total ? Math.round((matching / total) * 1000) / 10 : 0, flags };
}
