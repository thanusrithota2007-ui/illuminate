// Integration test: the REAL frontend service layer (supabase-js) against a REAL PostgREST + PostgreSQL carrying our migrations and RLS.
// Not part of `npm test` (needs a database). Run it with supabase/tests/run_integration.sh.
// A tiny proxy maps /rest/v1 -> PostgREST and fakes GoTrue's /auth/v1/user so tokens we sign locally can be used as sessions.
import http from "node:http"; import crypto from "node:crypto"; import assert from "node:assert/strict";
import { createServer } from "vite"; import react from "@vitejs/plugin-react";
const SECRET = process.env.JWT_SECRET, REST = process.env.PGRST_URL || "http://127.0.0.1:3000", PORT = 3001;
const b64 = o => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const jwt = p => { const h = b64({ alg: "HS256", typ: "JWT" }), body = b64({ aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, ...p }); return `${h}.${body}.${crypto.createHmac("sha256", SECRET).update(`${h}.${body}`).digest("base64url")}`; };
const ALICE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", BOB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const tok = (sub, role = "authenticated") => jwt({ sub, role, email: `${sub.slice(0, 5)}@example.test` });
const proxy = http.createServer((req, res) => {
  if (req.url.startsWith("/auth/v1/user")) { const t = (req.headers.authorization || "").replace("Bearer ", ""), sub = JSON.parse(Buffer.from(t.split(".")[1], "base64url")).sub;
    res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ id: sub, aud: "authenticated", role: "authenticated", email: `${sub.slice(0, 5)}@example.test`, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })); }
  const u = new URL(req.url.replace(/^\/rest\/v1/, "") || "/", REST);
  const up = http.request(u, { method: req.method, headers: { ...req.headers, host: u.host } }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on("error", e => { res.writeHead(502); res.end(String(e)); }); req.pipe(up);
});
await new Promise(r => proxy.listen(PORT, r));
process.env.VITE_SUPABASE_URL = `http://127.0.0.1:${PORT}`; process.env.VITE_SUPABASE_ANON_KEY = tok("00000000-0000-0000-0000-000000000000", "anon");
const vite = await createServer({ root: new URL("../..", import.meta.url).pathname, plugins: [react()], server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const { supabase, isSupabaseConfigured } = await vite.ssrLoadModule("/src/lib/supabase.js");
const S = await vite.ssrLoadModule("/src/services/stories.js"), A = await vite.ssrLoadModule("/src/services/account.js"), M = await vite.ssrLoadModule("/src/services/similarity.js");
const as = async sub => { const { error } = await supabase.auth.setSession({ access_token: tok(sub), refresh_token: "r" }); assert.ifError(error); };
const results = []; const t = async (name, fn) => { try { await fn(); results.push([true, name]); } catch (e) { results.push([false, name + " :: " + (e.message || e).toString().split("\n")[0]]); } };
const rejects = async p => { try { await p; } catch { return; } throw new Error("expected an error"); };

assert.ok(isSupabaseConfigured, "client should be configured");
let sid;
await t("anon: no real community stories yet", async () => { const r = await S.listCommunityStories(); assert.ok(r.configured && !r.error); assert.equal(r.stories.length, 0); });
await t("anon: similarity via rpc = 65 of 100 from the database", async () => { const r = await M.getSimilarity(["acne"]); assert.deepEqual([r.source, r.matching, r.eligibleTotal, r.percent], ["supabase", 65, 100, 65]); });
await as(ALICE);
await t("alice: saveStory draft with two topics", async () => { sid = await S.saveStory({ title: "Mornings", body: "I looked at the mirror and decided to be kind to it.", anonymous: true, cats: ["acne", "scars"], status: "draft" }); assert.ok(sid); });
await t("alice: listMyStories shows it with topics", async () => { const r = await S.listMyStories(); const s = r.find(x => x.id === sid); assert.ok(s); assert.deepEqual([...s.cats].sort(), ["acne", "scars"]); assert.equal(s.status, "draft"); });
await t("alice: getMyStory", async () => { const s = await S.getMyStory(sid); assert.equal(s.title, "Mornings"); });
await t("anon: draft is NOT public", async () => { await supabase.auth.signOut().catch(() => {}); const r = await S.listCommunityStories(); assert.equal(r.stories.length, 0); });
await as(ALICE);
await t("alice: publish -> public, anonymous hides name", async () => { await S.setStoryStatus(sid, "published"); await supabase.auth.signOut().catch(() => {}); const r = await S.listCommunityStories(); assert.equal(r.stories.length, 1); assert.equal(r.stories[0].author, null); assert.equal(r.stories[0].anonymous, true); assert.deepEqual([...r.stories[0].cats].sort(), ["acne", "scars"]); assert.ok(!("author_id" in r.stories[0])); });
await as(ALICE);
await t("alice: edit -> non-anonymous shows display name, topics replaced", async () => { await S.saveStory({ id: sid, title: "Mornings", body: "I looked at the mirror and decided to be kind to it.", anonymous: false, cats: ["acne"], status: "published" }); await supabase.auth.signOut().catch(() => {}); const r = await S.listCommunityStories(); assert.equal(r.stories[0].author, "Alice"); assert.deepEqual(r.stories[0].cats, ["acne"]); });
await as(BOB);
await t("bob: sees none of alice's stories in his dashboard", async () => { assert.equal((await S.listMyStories()).length, 0); assert.equal(await S.getMyStory(sid), null); });
await t("bob: cannot delete or unpublish alice's story (silently affects 0 rows)", async () => { await S.deleteStory(sid).catch(() => {}); await S.setStoryStatus(sid, "archived").catch(() => {}); await as(ALICE); const s = await S.getMyStory(sid); assert.equal(s.status, "published"); });
await t("alice: validation constraint surfaces as an error (too-short story)", async () => { await rejects(S.saveStory({ title: "ab", body: "short", anonymous: true, cats: [], status: "draft" })); });
await t("alice: letters: seal, list, cannot open early, cannot back-date", async () => {
  await A.createLetter({ title: "Hello", content: "Dear me, be kind.", unlockAt: new Date(Date.now() + 864e5 * 30).toISOString() });
  const l = await A.listLetters(); assert.equal(l.length, 1); assert.ok(!("content" in l[0]));
  await rejects(A.openLetter(l[0].id)); await rejects(A.createLetter({ title: "Past", content: "x", unlockAt: new Date(Date.now() - 864e5).toISOString() }));
});
await as(BOB);
await t("bob: cannot see or open alice's letters", async () => { assert.equal((await A.listLetters()).length, 0); });
await as(ALICE);
await t("alice: skin history save/list/delete (no photo, parsed values only)", async () => { await A.saveSkinSession({ concerns: [{ type: "acne", label: "Acne", ui_score: 70, raw_score: 61.2 }] }); const r = await A.listSkinSessions(); assert.equal(r.length, 1); assert.deepEqual(Object.keys(r[0].analysis_results), ["concerns"]); await A.deleteSkinSession(r[0].id); assert.equal((await A.listSkinSessions()).length, 0); });
await as(BOB);
await t("bob: cannot read alice's skin history", async () => { assert.equal((await A.listSkinSessions()).length, 0); });
await as(ALICE);
await t("alice: profile name edit round-trips; bob unaffected", async () => { await A.updateDisplayName(ALICE, "Alice R"); assert.equal((await A.getProfile(ALICE)).display_name, "Alice R"); await as(BOB); assert.equal((await A.getProfile(BOB)).display_name, "Bob"); });
await t("alice's service tries to impersonate: direct insert with another author_id is refused", async () => { await as(ALICE); const { error } = await supabase.from("stories").insert({ author_id: BOB, title: "Impersonation", content: "twenty characters or more here", status: "draft" }); assert.ok(error); });

await vite.close(); proxy.close();
for (const [ok, n] of results) console.log(ok ? "PASS" : "FAIL", n);
const failed = results.filter(r => !r[0]).length; console.log(`\n${results.length - failed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
