import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const real = v => typeof v === "string" && v.length > 0 && !v.startsWith("replace_");
/** True only when a real project URL and anon key are configured. When false the app runs in local demo mode and auth is unavailable. */
export const isSupabaseConfigured = real(url) && real(key);
export const supabase = isSupabaseConfigured ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
