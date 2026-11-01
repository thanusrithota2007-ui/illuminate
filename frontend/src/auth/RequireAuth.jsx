import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
/** UX guard only. Real protection is Supabase Auth + Row Level Security: without a valid session the database returns no private rows. */
export default function RequireAuth({ children }) {
  const { configured, loading, user } = useAuth(), loc = useLocation();
  if (!configured) return <AuthUnavailable />;
  if (loading) return <section className="page wall-paper"><p role="status" className="demo">Checking your session…</p></section>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return children;
}
export function AuthUnavailable() {
  return <section className="page wall-paper"><div className="intro"><h1>Accounts aren't switched on yet</h1>
    <p>Writing stories, sealing letters and saving results need a Supabase project. This copy of Illuminate hasn't been connected to one, so there is deliberately no pretend sign-in.</p>
    <p className="demo">Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>frontend/.env.local</code> (see the README), then restart the dev server.</p>
    <div className="row"><Link className="btn" to="/">Back to the Living Wall</Link><Link className="btn ghost" to="/skin-without-shame">Skin Without Shame</Link></div></div></section>;
}
