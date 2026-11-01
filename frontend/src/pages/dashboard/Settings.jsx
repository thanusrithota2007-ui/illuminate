import { useEffect, useState } from "react"; import { useNavigate } from "react-router-dom"; import { useAuth } from "../../auth/AuthContext.jsx"; import { getProfile, updateDisplayName } from "../../services/account.js";
export default function Settings() {
  const { user, signOut } = useAuth(), nav = useNavigate();
  const [name, setName] = useState(""), [loading, setLoading] = useState(true), [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { getProfile(user.id).then(p => setName(p.display_name || "")).catch(() => setErr("We couldn't load your profile.")).finally(() => setLoading(false)); }, [user.id]);
  const save = async e => { e.preventDefault(); setErr(""); setMsg(""); setBusy(true); try { await updateDisplayName(user.id, name); setMsg("Saved."); } catch { setErr("We couldn't save that. Please try again."); } finally { setBusy(false); } };
  return (<div><h1>Account Settings</h1>
    <form className="editor-form" onSubmit={save}>
      <label className="field">Email<input value={user.email || ""} readOnly /></label>
      <label className="field">Display name<input value={name} maxLength={60} disabled={loading} onChange={e => setName(e.target.value)} /><small>Shown on stories you publish without choosing anonymity.</small></label>
      <div className="row"><button className="btn" disabled={busy || loading}>{busy ? "Saving…" : "Save changes"}</button></div>
      {err && <p className="err" role="alert">{err}</p>}<p role="status" className="okmsg">{msg}</p></form>
    <h2>What Illuminate keeps</h2>
    <ul className="plain"><li>Your published stories are public. Anonymous ones never show your name.</li><li>Drafts, archived stories, sealed letters and saved results are private to you.</li><li>Photos you analyse go to YouCam for the analysis and are never stored by Illuminate.</li></ul>
    <div className="row"><button className="btn ghost" onClick={async () => { await signOut(); nav("/"); }}>Log out</button></div>
  </div>);
}
