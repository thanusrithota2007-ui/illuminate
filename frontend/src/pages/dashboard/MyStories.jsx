import { useCallback, useEffect, useState } from "react"; import { Link } from "react-router-dom";
import { listMyStories, setStoryStatus, deleteStory } from "../../services/stories.js"; import { catName } from "../../data/categories.js"; import { fmtDate } from "../../lib/format.js";
const LABEL = { draft: "Draft · private", published: "Published · public", archived: "Archived · private" };
export default function MyStories() {
  const [st, setSt] = useState({ loading: true, rows: [], err: "" }), [msg, setMsg] = useState("");
  const load = useCallback(() => listMyStories().then(rows => setSt({ loading: false, rows, err: "" })).catch(() => setSt({ loading: false, rows: [], err: "We couldn't load your stories. Please try again." })), []);
  useEffect(() => { load(); }, [load]);
  const act = async (fn, ok) => { setMsg(""); try { await fn(); setMsg(ok); await load(); } catch { setMsg("That didn't work. Please try again."); } };
  return (<div><div className="dash-head"><h1>My Stories</h1><Link className="btn" to="/dashboard/stories/new">Write a story</Link></div>
    <p className="demo">Drafts and archived stories are private. Published stories appear on the Living Wall, with your name only if you haven't chosen to be anonymous.</p>
    <p role="status" className="okmsg">{msg}</p>
    {st.loading ? <p className="demo" role="status">Loading…</p> : st.err ? <p className="err" role="alert">{st.err}</p>
      : !st.rows.length ? <div className="empty"><h2>Your first story is waiting</h2><p>A few honest sentences is plenty. You can save it as a draft and decide later whether to share it.</p><Link className="btn" to="/dashboard/stories/new">Start writing</Link></div>
      : <ul className="story-list">{st.rows.map(s => (<li key={s.id} className="paper-row">
        <div><span className={"badge " + s.status}>{LABEL[s.status]}</span>{s.anonymous && <span className="badge">Anonymous</span>}
          <h2>{s.title}</h2><p>{s.body.slice(0, 140).trim()}{s.body.length > 140 ? "…" : ""}</p>
          <small>{s.cats.map(catName).join(" · ") || "No topic"} · Updated {fmtDate(s.updatedAt)}</small></div>
        <div className="row"><Link className="btn ghost" to={`/dashboard/stories/${s.id}`}>Edit</Link>
          {s.status !== "published" && <button className="btn ghost" onClick={() => act(() => setStoryStatus(s.id, "published"), "Published to the Living Wall.")}>Publish</button>}
          {s.status === "published" && <button className="btn ghost" onClick={() => act(() => setStoryStatus(s.id, "draft"), "Moved back to drafts.")}>Unpublish</button>}
          {s.status !== "archived" && <button className="btn ghost" onClick={() => act(() => setStoryStatus(s.id, "archived"), "Archived.")}>Archive</button>}
          <button className="btn ghost" onClick={() => confirm("Delete this story permanently?") && act(() => deleteStory(s.id), "Deleted.")}>Delete</button></div></li>))}</ul>}
  </div>);
}
