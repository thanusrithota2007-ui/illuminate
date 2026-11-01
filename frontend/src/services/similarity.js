import { supabase } from "../lib/supabase.js";
import { computeSimilarity } from "../lib/similarity.js";
import community from "../data/demo_community.json";

/** Similarity for one or more topic slugs. Uses the Supabase demo tables when configured, else the identical local seed. */
export async function getSimilarity(slugs) {
  if (supabase) {
    const { data, error } = await supabase.rpc("demo_similarity", { p_category_slugs: slugs });
    const row = Array.isArray(data) ? data[0] : null;
    if (!error && row) return { eligibleTotal: row.eligible_total, matching: row.matching, percent: Number(row.percent), source: "supabase" };
  }
  const { eligibleTotal, matching, percent, flags } = computeSimilarity(community.profiles, slugs);
  return { eligibleTotal, matching, percent, flags, source: "local-seed" };
}
export const localDots = slugs => computeSimilarity(community.profiles, slugs).flags;
