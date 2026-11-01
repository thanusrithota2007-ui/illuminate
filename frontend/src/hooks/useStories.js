import { useEffect, useState } from "react";
import { listCommunityStories } from "../services/stories.js";
/** Real published community stories (empty until Supabase is configured and members publish). */
export default function useCommunityStories() {
  const [s, set] = useState({ loading: true, configured: false, stories: [], error: "" });
  useEffect(() => { let on = true; listCommunityStories().then(r => on && set({ loading: false, configured: r.configured, stories: r.stories, error: r.error || "" })); return () => { on = false; }; }, []);
  return s;
}
