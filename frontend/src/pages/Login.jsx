import { useState } from "react"; import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, authMessage } from "../auth/AuthContext.jsx"; import { AuthUnavailable } from "../auth/RequireAuth.jsx";

export default function Login() {
  const { configured, loading, user, signIn, signUp } = useAuth(), loc = useLocation(), nav = useNavigate(), [params] = useSearchParams();
  const from = loc.state?.from || "/dashboard";
  const [mode, setMode] = useState(params.get("mode") === "register" ? "register" : "login");
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [pw, setPw] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [ok, setOk] = useState("");
  if (!configured) return <AuthUnavailable />;
  if (!loading && user) return <Navigate to={from} replace />;
  const reg = mode === "register";
  const submit = async e => {
    e.preventDefault(); if (busy) return; setErr(""); setOk("");
    if (reg && pw.length < 8) return setErr("Please choose a password with at least 8 characters.");
    setBusy(true);
    try {
      if (reg) { const { data, error } = await signUp(email.trim(), pw, name.trim()); if (error) throw error;
        if (data.session) nav(from, { replace: true }); else setOk("Almost there. We've sent a confirmation link to your email. Open it, then come back and sign in."); }
      else { const { error } = await signIn(email.trim(), pw); if (error) throw error; nav(from, { replace: true }); }
    } catch (e2) { setErr(authMessage(e2)); } finally { setBusy(false); }
  };
  return (<section className="page wall-paper"><div className="auth-card">
    <h1>{reg ? "Create your space" : "Welcome back"}</h1>
    <p>{loc.state?.from ? "Please sign in to continue. We'll take you straight back." : reg ? "A private place for your stories, letters and results." : "Sign in to your stories, letters and saved results."}</p>
    <form onSubmit={submit} noValidate>
      {reg && <label className="field">Name shown on stories you don't post anonymously (optional)<input value={name} maxLength={60} onChange={e => setName(e.target.value)} autoComplete="nickname" /></label>}
      <label className="field">Email<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
      <label className="field">Password<input type="password" required minLength={reg ? 8 : undefined} value={pw} onChange={e => setPw(e.target.value)} autoComplete={reg ? "new-password" : "current-password"} /></label>
      <button className="btn" disabled={busy || !email || !pw}>{busy ? (reg ? "Creating…" : "Signing in…") : reg ? "Create account" : "Sign in"}</button>
      {err && <p className="err" role="alert">{err}</p>}{ok && <p className="okmsg" role="status">{ok}</p>}
    </form>
    <p className="demo">{reg ? "Already have an account? " : "New here? "}<button className="link" onClick={() => { setMode(reg ? "login" : "register"); setErr(""); setOk(""); }}>{reg ? "Sign in" : "Create an account"}</button></p>
  </div></section>);
}
