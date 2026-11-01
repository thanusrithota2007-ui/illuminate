import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

const MESSAGES = [
  [/invalid login credentials/i, "That email and password don't match. Please check them and try again."],
  [/email not confirmed/i, "Please confirm your email first. We sent you a link when you registered."],
  [/already registered|already been registered/i, "An account with this email already exists. Try signing in instead."],
  [/password should be at least|weak password/i, "Please choose a longer password (at least 8 characters)."],
  [/rate limit|too many/i, "Too many attempts. Please wait a moment and try again."],
  [/failed to fetch|network/i, "Could not reach the sign-in service. Check your connection and try again."],
];
export const authMessage = e => (MESSAGES.find(([re]) => re.test(e?.message || ""))?.[1]) || "Something went wrong. Please try again.";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null), [loading, setLoading] = useState(isSupabaseConfigured);
  useEffect(() => {
    if (!supabase) return;
    let on = true;
    supabase.auth.getSession().then(({ data, error }) => { if (on) { setSession(error ? null : data.session); setLoading(false); } }).catch(() => { if (on) { setSession(null); setLoading(false); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { on = false; subscription.unsubscribe(); };
  }, []);
  const value = useMemo(() => ({
    configured: isSupabaseConfigured, loading, session, user: session?.user ?? null,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password, displayName) => supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } }),
    signOut: () => supabase.auth.signOut(),
  }), [loading, session]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
