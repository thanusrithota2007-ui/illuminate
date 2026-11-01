import { useEffect, useRef, useState } from "react"; import { Link } from "react-router-dom";
import MirrorFrame from "../components/MirrorFrame.jsx"; import SkinResults from "../components/SkinResults.jsx"; import NotAlone from "../components/NotAlone.jsx";
import { useAuth } from "../auth/AuthContext.jsx"; import { saveSkinSession } from "../services/account.js";

export default function Skin({ embedded = false, onSaved }) {
  const { user } = useAuth();
  const [file, setFile] = useState(null), [url, setUrl] = useState(null), [ok, setOk] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [res, setRes] = useState(null), inp = useRef(), resRef = useRef();
  const [saved, setSaved] = useState(""), [saving, setSaving] = useState(false);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  useEffect(() => { if (res && window.matchMedia("(max-width:899px)").matches) resRef.current?.focus({ preventScroll: false }); }, [res]);
  const pick = f => { if (!f) return; setFile(f); setUrl(URL.createObjectURL(f)); setOk(false); setRes(null); setErr(""); setSaved(""); };
  const remove = () => { setFile(null); setUrl(null); setOk(false); setRes(null); setErr(""); setSaved(""); if (inp.current) inp.current.value = ""; };
  // Analysis request is unchanged from the original integration.
  const run = async () => {
    if (busy || !ok) return; setBusy(true); setErr(""); setRes(null); setSaved("");
    try { const fd = new FormData(); fd.append("image", file); const r = await fetch("/api/skin-analysis", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.detail || "Something went wrong. Please try again."); setRes(j);
    } catch (e) { setErr(e.message === "Failed to fetch" ? "Could not reach the ILLUMINATE server. Is the backend running?" : e.message); } finally { setBusy(false); }
  };
  const save = async () => { setSaving(true); setSaved(""); try { await saveSkinSession(res); setSaved("Saved to your private history."); onSaved?.(); } catch { setSaved("Could not save this result. Please try again."); } finally { setSaving(false); } };
  const footer = user
    ? <div className="save-row"><button className="btn ghost" disabled={saving || saved.startsWith("Saved")} onClick={save}>{saving ? "Saving…" : "Save these results privately"}</button><span role="status" className="demo">{saved || "Optional. Only the parsed results are saved, never your photo. Only you can see them."}</span></div>
    : <p className="demo">Want to keep a private copy? <Link to="/login" state={{ from: "/dashboard/skin" }}>Sign in</Link> to save results. Nothing is stored unless you choose to.</p>;
  return (<section className={"page wall-paper skin-page" + (embedded ? " embedded" : "")}>
    <div className="intro">{embedded ? <h2>Skin Without Shame</h2> : <h1>Skin Without Shame</h1>}<p>Get to know your skin without turning it into a measure of your worth.</p>
      <p className="demo">An AI skin analysis can offer information about selected skin concerns. It cannot determine your beauty, your value, or your overall health. It is not a medical diagnosis.</p></div>
    <div className={"skin" + (res ? " has-res" : "")}>
      <div className="mirror-wrap"><MirrorFrame src={url} alt="Your uploaded photo in the mirror" />{!url && <p className="invite">Choose a photo to place in the mirror.</p>}{busy && <p className="invite" role="status">Looking gently…</p>}</div>
      <div className="side">
        <div className="panel"><input ref={inp} id="f" type="file" accept="image/jpeg,image/png" hidden onChange={e => pick(e.target.files[0])} />
          <div className="row"><button className="btn" onClick={() => inp.current.click()}>{file ? "Replace photo" : "Choose a photo"}</button>{file && <button className="btn ghost" onClick={remove}>Remove photo</button>}</div>
          <p className="demo">JPEG or PNG, up to 10 MB, at least 480 px on the short side. Clear, front-facing, even light works best.</p>
          <label className="consent"><input type="checkbox" checked={ok} disabled={!file} onChange={e => setOk(e.target.checked)} /> I agree to send this photo to the YouCam (Perfect Corp) analysis service. It is processed under their terms and retention policies. ILLUMINATE does not store it.</label>
          <button className="btn" disabled={!file || !ok || busy} onClick={run}>{busy ? "Analysing…" : "Analyse my skin"}</button>
          {err && <p className="err" role="alert">{err}</p>}</div>
        {res && <SkinResults res={res} resRef={resRef} footer={footer} />}
      </div></div>
    <NotAlone />
  </section>);
}
