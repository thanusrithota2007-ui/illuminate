import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { CATEGORIES, catName, catBySlug, toSlug } from "../data/categories.js";
import { DEMO_STORIES } from "../data/stories.js";
import useCommunityStories from "../hooks/useStories.js";
import Photo from "../components/Photo.jsx";

function WallDetails() {
  return <>
    <svg className="wall-grid" viewBox="0 0 1000 760" preserveAspectRatio="none" aria-hidden="true">
      <rect x="75" y="48" width="850" height="664" />
      <path d="M160 48V712 M245 48V712 M330 48V712 M415 48V712 M500 48V712 M585 48V712 M670 48V712 M755 48V712 M840 48V712 M75 131H925 M75 214H925 M75 297H925 M75 380H925 M75 463H925 M75 546H925 M75 629H925" />
    </svg>
    <svg className="wall-threads" viewBox="0 0 1000 760" preserveAspectRatio="none" aria-hidden="true">
      <path className="thread thread-one" d="M10 120 C150 72 226 176 350 133 S540 75 670 120 858 176 990 106" />
      <path className="thread thread-two" d="M5 392 C145 443 242 332 375 378 S588 453 724 392 876 337 996 402" />
      <path className="thread thread-three" d="M8 648 C152 588 260 694 402 643 S644 590 770 650 895 686 992 622" />
      <g className="wall-bulbs">{[[44,111],[168,105],[292,130],[418,115],[544,101],[670,120],[806,147],[944,122],[24,396],[164,420],[306,390],[448,392],[586,425],[724,392],[850,355],[972,395],[52,631],[190,617],[330,666],[470,622],[610,620],[770,650],[870,675],[954,637]].map(([x,y],i)=><circle key={`${x}-${y}`} cx={x} cy={y} r={i%4===0?3.6:2.8}/>)}</g>
    </svg>
    <svg className="wall-leaves wall-leaves-left" viewBox="0 0 100 160" aria-hidden="true">
      <path d="M18 158 C35 112 37 68 76 14 M34 111 C12 102 9 89 8 76 M42 83 C63 82 74 68 81 56 M53 55 C34 49 30 37 31 25"/>
      <g><ellipse cx="12" cy="78" rx="11" ry="4" transform="rotate(20 12 78)"/><ellipse cx="77" cy="59" rx="11" ry="4" transform="rotate(-34 77 59)"/><ellipse cx="32" cy="27" rx="10" ry="4" transform="rotate(28 32 27)"/><ellipse cx="73" cy="20" rx="10" ry="4" transform="rotate(-45 73 20)"/></g>
    </svg>
    <svg className="wall-leaves wall-leaves-right" viewBox="0 0 100 160" aria-hidden="true">
      <path d="M82 158 C65 112 63 68 24 14 M66 111 C88 102 91 89 92 76 M58 83 C37 82 26 68 19 56 M47 55 C66 49 70 37 69 25"/>
      <g><ellipse cx="88" cy="78" rx="11" ry="4" transform="rotate(-20 88 78)"/><ellipse cx="23" cy="59" rx="11" ry="4" transform="rotate(34 23 59)"/><ellipse cx="68" cy="27" rx="10" ry="4" transform="rotate(-28 68 27)"/><ellipse cx="27" cy="20" rx="10" ry="4" transform="rotate(45 27 20)"/></g>
    </svg>
  </>;
}

export default function Wall() {
  const [params, setParams] = useSearchParams();
  const catParam = toSlug(params.get("cat")), storyParam = params.get("story");
  const [cat, setCat] = useState(catParam ?? "all");
  const [sel, setSel] = useState(null);
  const dlg = useRef(), opener = useRef();
  const live = useCommunityStories();
  const all = [...DEMO_STORIES, ...live.stories];

  useEffect(() => { if (catParam) setCat(catParam); }, [catParam]);
  useEffect(() => { if (!storyParam) return; const s = all.find(x => x.slug === storyParam || x.id === storyParam); if (s) setSel(s); }, [storyParam, live.stories]); // eslint-disable-line
  useEffect(() => { const d = dlg.current; if (sel && d && !d.open) d.showModal(); }, [sel]);

  const finish = () => { setSel(null); if (params.get("story")) { const p = new URLSearchParams(params); p.delete("story"); setParams(p, { replace: true }); } opener.current?.focus(); };
  const open = (e, s) => { opener.current = e.currentTarget; setSel(s); };
  const match = s => cat === "all" || s.cats.includes(cat);
  const shown = DEMO_STORIES.filter(match).length + live.stories.filter(match).length;
  const rel = sel ? all.filter(s => s.id !== sel.id && s.cats.some(c => sel.cats.includes(c))).slice(0, 4) : [];
  const topic = cat !== "all" ? catBySlug(cat) : null;

  return <section className="wall-page wall-paper">
    <div className="intro">
      <h1>The Living Wall</h1>
      <p>Little pieces of our stories, reminding us that we're not alone.</p>
      <div className="row wall-cta"><Link className="btn" to="/dashboard/stories/new">Write a story</Link><Link className="btn ghost" to="/skin-without-shame">Skin Without Shame</Link></div>
      <p className="demo wall-demo">Sample stories pinned to this wall are fictional prototype content. Published member stories appear below and are labelled separately.</p>
      <div className="row" role="group" aria-label="Filter stories">
        {[{ slug: "all", name: "All" }, ...CATEGORIES].map(c => <button key={c.slug} className={"chip" + (c.slug === cat ? " on" : "")} aria-pressed={c.slug === cat} onClick={() => setCat(c.slug)}>{c.name}</button>)}
      </div>
      {topic && <p className="catnote" role="status">{shown} {shown === 1 ? "story" : "stories"} about {topic.name.toLowerCase()}. {topic.description}</p>}
    </div>
    <div className="wall-arrangement">
      <WallDetails />
      <div className="wall-cards">
        {DEMO_STORIES.map(s => <button key={s.id} className={`obj ${s.kind}${s.image ? " has-image" : ""}` + (!match(s) ? " dim" : "")} style={{ "--r": s.r + "deg" }}
          onClick={e => open(e, s)} aria-label={`Read story: ${s.title} (demonstration story)`}>
          <span className="pin" aria-hidden="true" />
          {(s.image || s.kind === "polaroid" || s.kind === "photo") && <span className="pic" aria-hidden="true">
            {s.image ? <img src={s.image} alt="" loading="lazy" decoding="async" /> : <Photo id={s.n} />}
          </span>}
          <strong>{s.title}</strong>
          {s.kind === "note" && <em>{s.body.slice(0, 90)}…</em>}
          <small>{catName(s.cats[0])} · Illustrative story</small>
        </button>)}
      </div>
    </div>
    <div className="community">
      <h2>Shared by our community</h2>
      {live.loading ? <p className="demo" role="status">Loading community stories…</p>
        : !live.configured ? <p className="demo">Member stories aren't switched on in this copy yet, because it hasn't been connected to a Supabase project.</p>
        : live.error ? <p className="err" role="alert">{live.error}</p>
        : live.stories.filter(match).length ? <div className="journal">
          {live.stories.filter(match).map(s => <article key={s.id} className="slip real"><small className="label">{s.cats.map(catName).join(" · ") || "Story"} · Shared by {s.anonymous ? "an anonymous member" : s.author || "a member"}</small>
            <h3>{s.title}</h3><p>{s.body.slice(0, 220).trim()}{s.body.length > 220 ? "…" : ""}</p><button className="link" onClick={e => open(e, s)}>Read the whole story</button></article>)}
        </div> : <p className="demo">No community stories {topic ? `about ${topic.name.toLowerCase()} ` : ""}have been published yet. Yours could be the first.</p>}
      <div className="row"><Link className="btn" to="/dashboard/stories/new">Write a story</Link><span className="demo">You'll be asked to sign in. Drafts stay private until you publish.</span></div>
    </div>
    <dialog ref={dlg} className="paper-modal" onClose={finish} aria-labelledby="st">
      {sel && <><small className="label">{sel.cats.map(catName).join(" · ")}</small>
        <h2 id="st">{sel.title}</h2>
        {sel.isDemo ? <p className="demo demo-badge">Illustrative story · fictional prototype content.</p> : <p className="demo">Published by {sel.anonymous ? "an anonymous member" : sel.author || "a member"}.</p>}
        <p className="story-body">{sel.body}</p>
        {rel.length > 0 && <p className="rel">More like this: {rel.map(r => <button key={r.id} className="link" onClick={() => setSel(r)}>{r.title}</button>)}</p>}
        <button className="btn" autoFocus onClick={() => dlg.current.close()}>Back to the wall</button></>}
    </dialog>
  </section>;
}
