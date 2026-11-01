import { useEffect, useState } from "react"; import { Link, useNavigate, useParams } from "react-router-dom";
import { CATEGORIES } from "../../data/categories.js"; import { getMyStory, saveStory } from "../../services/stories.js";
const LIMITS = { title: [3, 120], body: [20, 5000] };
export default function StoryEditor() {
  const { id } = useParams(), nav = useNavigate();
  const [f, setF] = useState({ title: "", body: "", anonymous: true, cats: [], status: "draft" }), [loading, setLoading] = useState(!!id), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  useEffect(() => { if (!id) return; getMyStory(id).then(s => { if (!s) setErr("We couldn't find that story."); else setF(s); }).catch(() => setErr("We couldn't load that story.")).finally(() => setLoading(false)); }, [id]);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const toggle = slug => set("cats", f.cats.includes(slug) ? f.cats.filter(c => c !== slug) : [...f.cats, slug]);
  const go = async status => {
    setErr("");
    const t = f.title.trim().length, b = f.body.trim().length;
    if (t < LIMITS.title[0] || t > LIMITS.title[1]) return setErr(`Please give your story a title of ${LIMITS.title[0]} to ${LIMITS.title[1]} characters.`);
    if (b < LIMITS.body[0] || b > LIMITS.body[1]) return setErr(`Your story needs ${LIMITS.body[0]} to ${LIMITS.body[1]} characters (it's ${b} now).`);
    setBusy(true);
    try { await saveStory({ id, ...f, status }); nav("/dashboard/stories"); } catch { setErr("We couldn't save your story. Please try again."); setBusy(false); }
  };
  const pub = f.status === "published";
  if (loading) return <p className="demo" role="status">Loading…</p>;
  return (<div><h1>{id ? "Edit your story" : "Write a story"}</h1>
    <p className="demo">Write in your own words. You decide whether it is shared, and whether your name appears. Please don't include other people's names or anything that identifies someone.</p>
    <div className="editor-form">
      <label className="field">Title<input value={f.title} maxLength={120} onChange={e => set("title", e.target.value)} /></label>
      <label className="field">Your story<textarea rows={11} value={f.body} maxLength={5000} onChange={e => set("body", e.target.value)} /><small>{f.body.trim().length} / 5000</small></label>
      <fieldset className="topics"><legend>Topics (choose any that fit)</legend>{CATEGORIES.map(c => <label key={c.slug} className="chip-check"><input type="checkbox" checked={f.cats.includes(c.slug)} onChange={() => toggle(c.slug)} /> {c.name}</label>)}</fieldset>
      <label className="consent"><input type="checkbox" checked={f.anonymous} onChange={e => set("anonymous", e.target.checked)} /> Show this story anonymously (your name is hidden on the Living Wall)</label>
      <div className="row"><button className="btn" disabled={busy} onClick={() => go(pub ? "published" : "draft")}>{busy ? "Saving…" : pub ? "Save changes" : "Save draft"}</button>
        <button className="btn ghost" disabled={busy} onClick={() => go(pub ? "draft" : "published")}>{pub ? "Move back to drafts" : "Publish to the Living Wall"}</button>
        <Link className="btn ghost" to="/dashboard/stories">Cancel</Link></div>
      {err && <p className="err" role="alert">{err}</p>}
    </div></div>);
}
