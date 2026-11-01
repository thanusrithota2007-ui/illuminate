import { useEffect, useState } from "react"; import { Link } from "react-router-dom";
import { CATEGORIES, catBySlug } from "../data/categories.js"; import { DEMO_STORIES } from "../data/stories.js";
import { getSimilarity } from "../services/similarity.js"; import useCommunityStories from "../hooks/useStories.js";

/** "You are not alone": a topic-first, non-competitive community experience. */
export default function NotAlone() {
  const [slug, setSlug] = useState(null), [sim, setSim] = useState(null);
  const community = useCommunityStories();
  useEffect(() => { if (!slug) { setSim(null); return; } let on = true; setSim(null); getSimilarity([slug]).then(r => on && setSim(r)); return () => { on = false; }; }, [slug]);
  const topic = slug && catBySlug(slug);
  const demo = slug ? DEMO_STORIES.filter(s => s.cats.includes(slug)) : [];
  const real = slug ? community.stories.filter(s => s.cats.includes(slug)) : [];
  return (<section className="na" aria-labelledby="na-h">
    <div className="na-head"><h2 id="na-h">You are not alone</h2>
      <p className="na-lead">Lots of people carry quiet feelings about their skin and how they look. Pick a topic that feels close to you, or skip this part. You don't need a photo analysis to be here.</p>
      <p className="na-demo">Sample stories are fictional prototype content; published member stories are labelled separately.</p></div>
    <div className="row" role="group" aria-label="Choose a topic">
      {CATEGORIES.map(c => <button key={c.slug} className={"chip" + (c.slug === slug ? " on" : "")} aria-pressed={c.slug === slug} onClick={() => setSlug(c.slug === slug ? null : c.slug)}>{c.name}</button>)}
    </div>
    {!slug && <p className="na-hint">Choosing a topic isn't saved anywhere and isn't linked to your photo.</p>}
    {slug && <div className="na-body" aria-live="polite">
      {!sim ? <p className="demo" role="status">Gathering the demonstration data…</p> : <>
        <figure className="na-dots" aria-label={`${sim.matching} of ${sim.eligibleTotal} illustrative profiles shared a similar concern`}>
          <div className="dots" aria-hidden="true">{Array.from({ length: sim.eligibleTotal }, (_, i) => <i key={i} className={i < sim.matching ? "on" : ""} />)}</div>
          <figcaption>Each dot represents one profile</figcaption></figure>
        <div className="na-text">
          <p className="na-headline"><strong>{Math.round(sim.percent)}%</strong> <span>({sim.matching} of {sim.eligibleTotal})</span> reported a similar concern about <b>{topic.name.toLowerCase()}</b>. <small>Illustrative prototype data, not real community statistics.</small></p>
          <details className="na-how"><summary>How this is calculated</summary>
            <p>A demo profile counts as similar when it reported the topic you chose. The percentage is matching profiles divided by all {sim.eligibleTotal} eligible demo profiles, times 100. It doesn't use your photo, your face, or any YouCam score, and it isn't a validated measure of anything about you. {sim.source === "supabase" ? "Calculated live from the demo tables in the database." : "Calculated from the same demo dataset bundled with the app."}</p></details>
        </div></>}
      <h3 className="na-sub">Stories about {topic.name.toLowerCase()}</h3>
      <div className="journal">
        {demo.map(s => <article key={s.id} className="slip"><small className="label">Illustrative story</small><h4>{s.title}</h4><p>{s.body.slice(0, 150).trim()}…</p>
          <Link className="more" to={`/?cat=${slug}&story=${s.slug}`}>Read this story on the Living Wall</Link></article>)}
        {real.map(s => <article key={s.id} className="slip real"><small className="label">Shared by {s.anonymous ? "an anonymous member" : s.author || "a member"}</small><h4>{s.title}</h4><p>{s.body.slice(0, 150).trim()}…</p>
          <Link className="more" to={`/?cat=${slug}&story=${s.slug || s.id}`}>Read on the Living Wall</Link></article>)}
      </div>
      <Link className="more" to={`/?cat=${slug}`}>See every {topic.name.toLowerCase()} story on the Living Wall</Link>
    </div>}
  </section>);
}
