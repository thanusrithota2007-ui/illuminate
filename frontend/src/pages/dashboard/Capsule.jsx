import { useCallback, useEffect, useState } from "react";
import { listLetters, createLetter, openLetter, deleteLetter } from "../../services/account.js"; import { fmtDate, daysUntil } from "../../lib/format.js";
const tomorrow = () => { const d = new Date(Date.now() + 86400000); return d.toISOString().slice(0, 10); };
export default function Capsule() {
  const [st, setSt] = useState({ loading: true, rows: [], err: "" }), [open, setOpen] = useState(null), [msg, setMsg] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(""), [content, setContent] = useState(""), [date, setDate] = useState("");
  const load = useCallback(() => listLetters().then(rows => setSt({ loading: false, rows, err: "" })).catch(() => setSt({ loading: false, rows: [], err: "We couldn't load your letters." })), []);
  useEffect(() => { load(); }, [load]);
  const seal = async e => {
    e.preventDefault(); setErr(""); setMsg("");
    if (!title.trim() || !content.trim() || !date) return setErr("Please add a title, your letter and an unlock date.");
    const at = new Date(date + "T09:00:00"); if (at <= new Date()) return setErr("Choose a date in the future. The letter stays sealed until then.");
    setBusy(true);
    try { await createLetter({ title: title.trim(), content: content.trim(), unlockAt: at.toISOString() }); setTitle(""); setContent(""); setDate(""); setMsg("Sealed. It will wait for you."); await load(); }
    catch { setErr("We couldn't seal your letter. Please try again."); } finally { setBusy(false); }
  };
  const view = async l => { setErr(""); try { setOpen(await openLetter(l.id)); await load(); } catch (e) { setErr(/sealed/i.test(e.message || "") ? "That letter is still sealed." : "We couldn't open that letter."); } };
  const del = async l => { if (!confirm("Delete this letter forever?")) return; try { await deleteLetter(l.id); if (open?.id === l.id) setOpen(null); await load(); } catch { setErr("We couldn't delete that letter."); } };
  const now = Date.now();
  return (<div><h1>Time Machine</h1>
    <p>Write to the version of you who will look back on this moment. Once sealed, a letter can't be read, even by you, until its date arrives.</p>
    <form className="editor-form" onSubmit={seal}>
      <label className="field">Title<input value={title} maxLength={120} onChange={e => setTitle(e.target.value)} /></label>
      <label className="field">Dear future me…<textarea rows={8} value={content} maxLength={10000} onChange={e => setContent(e.target.value)} /></label>
      <label className="field">Open on<input type="date" min={tomorrow()} value={date} onChange={e => setDate(e.target.value)} /></label>
      <div className="row"><button className="btn" disabled={busy}>{busy ? "Sealing…" : "Seal this letter"}</button></div>
      {err && <p className="err" role="alert">{err}</p>}<p role="status" className="okmsg">{msg}</p></form>
    <h2>Your letters</h2>
    {st.loading ? <p className="demo" role="status">Loading…</p> : st.err ? <p className="err" role="alert">{st.err}</p> : !st.rows.length ? <div className="empty"><p>No letters yet. Your future self would love to hear from you.</p></div>
      : <ul className="story-list">{st.rows.map(l => { const ready = new Date(l.unlock_at).getTime() <= now; return (<li key={l.id} className="paper-row">
        <div><span className={"badge " + (ready ? "published" : "draft")}>{ready ? (l.opened_at ? "Opened" : "Ready to open") : "Sealed"}</span><h3>{l.title}</h3>
          <small>{ready ? `Unlocked ${fmtDate(l.unlock_at)}` : `Opens ${fmtDate(l.unlock_at)} · ${daysUntil(l.unlock_at)} days to go`}</small></div>
        <div className="row">{ready && <button className="btn ghost" onClick={() => view(l)}>Open letter</button>}<button className="btn ghost" onClick={() => del(l)}>Delete</button></div></li>); })}</ul>}
    {open && <article className="stationery" aria-label="Opened letter"><time>{fmtDate(open.unlock_at)}</time><p><b>{open.title}</b></p><p>Dear future me,</p><p className="body">{open.content}</p><p>With love, me</p><button className="btn ghost" onClick={() => setOpen(null)}>Close letter</button></article>}
  </div>);
}
