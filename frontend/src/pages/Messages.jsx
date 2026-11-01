import { useEffect, useState } from "react";
const F = [
 { id: "insecure", t: "I'm feeling insecure", m: ["Feeling unsure about how you look is a very human thing, and you don't have to argue yourself out of it today.", "You can notice the feeling without agreeing with it. It is a visitor, not a verdict.", "Insecurity often gets louder in mirrors and quieter around people who care about you. Maybe reach for one of them."] },
 { id: "compare", t: "I'm comparing myself to others", m: ["You are seeing someone's chosen, edited moments next to your whole, ordinary day.", "Comparison makes the world smaller. Try looking at something that has nothing to do with faces for a minute.", "Someone is probably envying something about you right now, and you can't see it either."] },
 { id: "skinday", t: "I'm having a difficult skin day", m: ["Today's skin is today's skin. It will change, and so will how you feel about it.", "You can be gentle with your skin and still go outside. Nobody's day depends on your complexion.", "A hard skin day is allowed to be annoying. It doesn't have to mean anything about you."] },
 { id: "tone", t: "I'm struggling with skin-tone insecurity", m: ["Your skin tone carries your family and your places. It isn't something you owe anyone an apology for.", "The standards that taught you to doubt your colour were made by people, and they can be unlearned slowly.", "It's okay if this feels heavy. You deserve to see people who look like you being loved."] },
 { id: "encourage", t: "I need encouragement", m: ["You don't have to feel beautiful to be worthy of a good day.", "Small kindnesses count: water, a walk, a message to a friend. You are allowed to do the next small thing.", "You've been getting through hard days for a long time. That is real strength."] },
];
const KEY = "illuminate.favourites";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
export default function Messages() {
  const [f, setF] = useState(F[0].id), [favs, setFavs] = useState(load), [note, setNote] = useState("");
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(favs)); } catch { setNote("Favourites could not be saved in this browser."); } }, [favs]);
  const cur = F.find(x => x.id === f), key = (fid, i) => `${fid}:${i}`;
  const toggle = k => setFavs(a => a.includes(k) ? a.filter(x => x !== k) : [...a, k]);
  const saved = favs.map(k => { const [fid, i] = k.split(":"); const x = F.find(y => y.id === fid); return x && x.m[+i] ? { k, text: x.m[+i] } : null; }).filter(Boolean);
  return (<section className="page wall-paper"><div className="intro"><h1>Supportive Messages</h1><p>Choose what's closest to how you feel right now. These notes were written for this project, not by community members.</p></div>
    <div className="msgs"><div role="radiogroup" aria-label="How are you feeling?" className="feel">{F.map(x => <button key={x.id} role="radio" aria-checked={x.id === f} className={"chip" + (x.id === f ? " on" : "")} onClick={() => setF(x.id)}>{x.t}</button>)}</div>
      <div className="journal">{cur.m.map((t, i) => { const k = key(cur.id, i), on = favs.includes(k); return (<article key={k} className="slip" style={{ "--r": (i % 2 ? 1.2 : -1.2) + "deg" }}><p>{t}</p>
        <button className="btn ghost" aria-pressed={on} onClick={() => toggle(k)}>{on ? "Saved" : "Save this"}</button></article>); })}</div>
      <h2>Your saved messages</h2>{saved.length ? <div className="journal">{saved.map(s => <article key={s.k} className="slip"><p>{s.text}</p><button className="btn ghost" onClick={() => toggle(s.k)}>Remove</button></article>)}</div> : <p className="demo">Nothing saved yet. Saved messages stay in this browser only.</p>}
      <p role="status" className="err">{note}</p></div></section>);
}
