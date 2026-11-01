import { supabase } from "../lib/supabase.js";
export async function getProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).maybeSingle();
  if (error) throw error; return data ?? { display_name: "", avatar_url: null };
}
export async function updateDisplayName(userId, name) {
  const v = name.trim() || null;
  // The profile row is created by a trigger at registration. Update it; only if it is missing (very old accounts) insert it.
  // RLS pins both operations to the signed-in user, and `id` is not an updatable column.
  const { data, error } = await supabase.from("profiles").update({ display_name: v }).eq("id", userId).select("id");
  if (error) throw error;
  if (!data.length) { const ins = await supabase.from("profiles").insert({ id: userId, display_name: v }); if (ins.error) throw ins.error; }
}
export const LETTER_COLS = "id, title, unlock_at, created_at, opened_at";
export async function listLetters() { const { data, error } = await supabase.from("time_capsule_letters").select(LETTER_COLS).order("unlock_at"); if (error) throw error; return data; }
export async function createLetter({ title, content, unlockAt }) { const { error } = await supabase.from("time_capsule_letters").insert({ title, content, unlock_at: unlockAt }); if (error) throw error; }
export async function openLetter(id) { const { data, error } = await supabase.rpc("open_letter", { p_letter_id: id }); if (error) throw error; return data; }
export async function deleteLetter(id) { const { error } = await supabase.from("time_capsule_letters").delete().eq("id", id); if (error) throw error; }
export async function listSkinSessions() { const { data, error } = await supabase.from("skin_analysis_sessions").select("id, analysis_results, created_at").order("created_at", { ascending: false }).limit(20); if (error) throw error; return data; }
export async function saveSkinSession(results) {
  // Parsed concern values only. The photo itself never leaves the browser except for the YouCam analysis call.
  const analysis_results = { concerns: results.concerns.map(c => ({ type: c.type, label: c.label, ui_score: c.ui_score, raw_score: c.raw_score })) };
  const { error } = await supabase.from("skin_analysis_sessions").insert({ analysis_results }); if (error) throw error;
}
export async function deleteSkinSession(id) { const { error } = await supabase.from("skin_analysis_sessions").delete().eq("id", id); if (error) throw error; }
