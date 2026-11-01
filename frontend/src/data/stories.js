import stories from "./demo_stories.json";
// Curated, clearly labelled synthetic stories. The same rows are seeded into Supabase (scripts/generate_seed.py).
export const DEMO_STORIES = stories.map((s, i) => ({ ...s, id: s.slug, n: i, isDemo: true, anonymous: true, author: null, status: "published" }));
