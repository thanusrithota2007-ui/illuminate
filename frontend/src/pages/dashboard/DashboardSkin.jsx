import { useCallback, useEffect, useState } from "react"; import Skin from "../Skin.jsx";
import { listSkinSessions, deleteSkinSession } from "../../services/account.js"; import { fmtDate } from "../../lib/format.js";
export default function DashboardSkin() {
  const [rows, setRows] = useState(null), [err, setErr] = useState("");
  const load = useCallback(() => listSkinSessions().then(r => { setRows(r); setErr(""); }).catch(() => setErr("We couldn't load your saved results.")), []);
  useEffect(() => { load(); }, [load]);
  const del = async id => { try { await deleteSkinSession(id); await load(); } catch { setErr("We couldn't delete that result."); } };
  return (<div><h1>Skin Analysis</h1><Skin embedded onSaved={load} />
    <section className="history"><h2>Saved results</h2><p className="demo">Only you can see these. They contain the parsed results, never your photo. Delete them any time.</p>
      {err && <p className="err" role="alert">{err}</p>}
      {rows === null ? <p className="demo" role="status">Loading…</p> : !rows.length ? <div className="empty"><p>Nothing saved yet. After an analysis you can choose to keep a private copy.</p></div>
        : <ul className="story-list">{rows.map(r => <li key={r.id} className="paper-row"><div><h3>Snapshot from {fmtDate(r.created_at)}</h3><small>{(r.analysis_results.concerns || []).map(c => c.label).join(" · ")}</small></div><button className="btn ghost" onClick={() => del(r.id)}>Delete</button></li>)}</ul>}
    </section></div>);
}
