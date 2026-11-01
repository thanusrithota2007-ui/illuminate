import { useState } from "react"; import { DESC } from "../data/concerns.js";
/** Compassionate presentation of YouCam's display score only. */
export default function SkinResults({ res, footer, resRef }) {
  const [show, setShow] = useState(false);
  return (<div className="results" ref={resRef} tabIndex="-1" aria-label="Your skin reflection">
    <h2>Your skin reflection</h2>
    <p className="snapshot">This is a snapshot of one photo in one kind of light. It isn't a full picture of your skin or your health, and it says nothing about your beauty or your worth.</p>
    <p className="demo">{res.notice}</p>
    {res.concerns.length ? <>
      <ul className="reflect">{res.concerns.map(c => (<li key={c.type}>
        <h3>{c.label}</h3>
        <p className="desc">{DESC[c.type] || "One of the areas YouCam's analysis looks at in a photo."}</p>
        {show && <div className="nums"><span>{c.ui_score != null ? `YouCam display score: ${c.ui_score}` : "YouCam did not provide a display score"}</span>
          {c.ui_score != null && <div className="meter" role="img" aria-label={`Display score ${c.ui_score} on a 1 to 100 scale`}><i style={{ width: Math.min(100, Math.max(1, c.ui_score)) + "%" }} /></div>}</div>}
      </li>))}</ul>
      <label className="consent"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} /> Show YouCam display scores (optional)</label>
      {show && <details className="about" open><summary>About this score</summary><p>This is YouCam's display score for one photo under particular lighting conditions. It is only a limited snapshot, not a measure of your skin's whole story, your health, or your worth.</p></details>}
    </> : <p>The analysis finished, but no concern scores came back for this photo.</p>}
    {footer}
  </div>);
}
