import { supabase } from "../lib/supabase.js";

let catCache = null;
export async function categoryIds() {
  if (catCache) return catCache;
  const { data, error } = await supabase.from("story_categories").select("id, slug");
  if (error) throw error;
  return (catCache = Object.fromEntries(data.map(c => [c.slug, c.id])));
}
const fromPublic = r => ({ id: r.id, slug: r.slug, title: r.title, body: r.content, cats: r.category_slugs ?? [], isDemo: r.is_demo_content, anonymous: r.is_anonymous || r.is_demo_content, author: r.author_display_name, publishedAt: r.published_at, status: "published" });

/** Published stories written by real members (never demo rows). Empty with configured=false when Supabase is not set up. */
export async function listCommunityStories() {
  if (!supabase) return { configured: false, stories: [] };
  const { data, error } = await supabase.from("public_stories").select("*").eq("is_demo_content", false).order("published_at", { ascending: false }).limit(60);
  if (error) return { configured: true, stories: [], error: "Community stories could not be loaded right now." };
  return { configured: true, stories: data.map(fromPublic) };
}

const fromOwn = r => ({ id: r.id, title: r.title, body: r.content, status: r.status, anonymous: r.is_anonymous, updatedAt: r.updated_at, publishedAt: r.published_at,
  cats: (r.story_category_assignments ?? []).map(a => a.story_categories?.slug).filter(Boolean) });
const OWN = "id, title, content, status, is_anonymous, updated_at, published_at, story_category_assignments(story_categories(slug))";

export async function listMyStories() {
  const { data, error } = await supabase.from("stories").select(OWN).order("updated_at", { ascending: false });
  if (error) throw error; return data.map(fromOwn);
}
export async function getMyStory(id) {
  const { data, error } = await supabase.from("stories").select(OWN).eq("id", id).maybeSingle();
  if (error) throw error; return data ? fromOwn(data) : null;
}
async function setTopics(storyId, slugs) {
  const ids = await categoryIds();
  const del = await supabase.from("story_category_assignments").delete().eq("story_id", storyId);
  if (del.error) throw del.error;
  if (slugs.length) { const ins = await supabase.from("story_category_assignments").insert(slugs.map(s => ({ story_id: storyId, category_id: ids[s] })).filter(r => r.category_id)); if (ins.error) throw ins.error; }
}
/** author_id is never sent: the database fills it from the signed-in user and RLS enforces it. */
export async function saveStory({ id, title, body, anonymous, cats, status }) {
  const row = { title: title.trim(), content: body.trim(), is_anonymous: anonymous, status };
  let sid = id;
  if (id) { const { error } = await supabase.from("stories").update(row).eq("id", id); if (error) throw error; }
  else { const { data, error } = await supabase.from("stories").insert(row).select("id").single(); if (error) throw error; sid = data.id; }
  await setTopics(sid, cats);
  return sid;
}
export async function setStoryStatus(id, status) { const { error } = await supabase.from("stories").update({ status }).eq("id", id); if (error) throw error; }
export async function deleteStory(id) { const { error } = await supabase.from("stories").delete().eq("id", id); if (error) throw error; }
