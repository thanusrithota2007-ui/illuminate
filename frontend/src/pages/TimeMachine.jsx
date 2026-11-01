import { useEffect, useState } from "react"; import { Link } from "react-router-dom"; import { useAuth } from "../auth/AuthContext.jsx";
const KEY = "illuminate.letter", P = ["What do you wish someone had told you today?", "What are you learning to accept about yourself?", "What would you like your future self to remember?"];
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { text: "", date: "" }; } catch { return { text: "", date: "" }; } };
export default function TimeMachine() {
  const { configured } = useAuth();
  const [l, setL] = useState(load), [msg, setMsg] = useState("");
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 3000); return () => clearTimeout(t); }, [msg]);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(l)); setMsg("Saved on this browser."); } catch { setMsg("Could not save in this browser."); } };
  const clear = () => { if (confirm("Clear this letter and start again?")) { setL({ text: "", date: "" }); try { localStorage.removeItem(KEY); } catch {} } };
  const dl = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([`${l.date}\n\n${l.text}`], { type: "text/plain" })); a.download = "letter-to-future-me.txt"; a.click(); URL.revokeObjectURL(a.href); };
  return (<section className="page wall-paper"><div className="intro"><h1>A little note for the girl you're becoming.</h1>
    <p>Write to the version of you who will look back on this moment with a little more understanding.</p></div>
    <div className="tm"><div className="editor"><ul>{P.map(p => <li key={p}>{p}</li>)}</ul>
      <label>Date (optional)<input type="date" value={l.date} onChange={e => setL({ ...l, date: e.target.value })}/></label>
      <label>Your letter<textarea rows="10" value={l.text} onChange={e => setL({ ...l, text: e.target.value })}/></label>
      <div className="row"><button className="btn" onClick={save}>Save letter</button><button className="btn ghost" onClick={dl}>Download</button><button className="btn ghost" onClick={() => window.print()}>Print</button><button className="btn ghost" onClick={clear}>Clear and restart</button></div>
      <p role="status" className="demo">{msg}</p>
      <p className="demo">Letters stay in this browser on this device only. Local storage is not a secure vault: anyone using this browser can read it, and clearing browser data deletes it.</p></div>
      <article className="stationery" aria-label="Letter preview">{l.date && <time>{l.date}</time>}<p>Dear future me,</p><p className="body">{l.text || "Your letter will appear here as you write."}</p><p>With love, me</p></article></div>
    {configured && <p className="demo cta-account">Want letters that stay sealed until a future date and are saved privately to your account? <Link to="/login" state={{ from: "/dashboard/time-machine" }}>Sign in or create an account</Link>.</p>}
  </section>);
}
