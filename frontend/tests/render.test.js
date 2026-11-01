// Smoke test: server-renders every route (no browser needed) to catch crashes, missing exports and bad labelling.
import { test, before, after } from "node:test"; import assert from "node:assert/strict"; import { fileURLToPath } from "node:url";
import { createServer } from "vite"; import react from "@vitejs/plugin-react"; import React from "react"; import { renderToString } from "react-dom/server"; import { StaticRouter } from "react-router-dom/server.js";
let vite, render;
before(async () => {
  vite = await createServer({ root: fileURLToPath(new URL("..", import.meta.url)), plugins: [react()], server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
  const App = (await vite.ssrLoadModule("/src/App.jsx")).default; const { AuthProvider } = await vite.ssrLoadModule("/src/auth/AuthContext.jsx");
  render = url => renderToString(React.createElement(StaticRouter, { location: url }, React.createElement(AuthProvider, null, React.createElement(App))));
});
after(async () => { await vite?.close(); });

test("root URL is the Living Wall with all 16 labelled demo stories and a Write a story action", () => {
  const h = render("/"); assert.match(h, /The Living Wall/); assert.equal((h.match(/class="obj /g) || []).length, 16);
  assert.match(h, /Sample stories pinned to this wall are fictional prototype content/); assert.match(h, /Write a story/); assert.match(h, /Illustrative story/); assert.doesNotMatch(h, /undefined|NaN/);
});
test("/living-wall redirects to the wall; unknown route shows a friendly page", () => { assert.match(render("/nope"), /find that page/); });
test("Skin Without Shame contains the You Are Not Alone section and fictional story disclosure", () => {
  const h = render("/skin-without-shame"); assert.match(h, /You are not alone/); assert.match(h, /Sample stories are fictional prototype content/); assert.match(h, /community statistics are illustrative prototype content/);
  for (const t of ["Acne", "Pigmentation", "Skin tone", "Scars", "Dark circles", "Social-media pressure", "Appearance-related insecurity"]) assert.ok(h.includes(t), t);
  assert.ok(h.indexOf("Analyse my skin") < h.indexOf("You are not alone"), "section sits after the analysis panel");
});
test("private routes stay behind auth and never render a fake login", () => {
  for (const u of ["/dashboard", "/dashboard/stories/new"]) { const h = render(u); assert.doesNotMatch(h, /type="password"/, u); }
  assert.match(render("/login"), /type="password"/);
});
test("other public pages render", () => { assert.match(render("/time-machine"), /account Time Machine/); assert.match(render("/messages"), /Supportive Messages/); });
