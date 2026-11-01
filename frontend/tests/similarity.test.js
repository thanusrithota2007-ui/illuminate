import { test } from "node:test"; import assert from "node:assert/strict"; import { readFileSync, existsSync } from "node:fs";
import { computeSimilarity } from "../src/lib/similarity.js";
const read = f => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const { profiles } = read("demo_community.json"), cats = read("categories.json"), stories = read("demo_stories.json");

test("dataset: 120 synthetic profiles, exactly 100 eligible, all ids synthetic", () => {
  assert.equal(profiles.length, 120); assert.equal(profiles.filter(p => p.eligible).length, 100);
  assert.ok(profiles.every(p => /^DEMO-\d{4}$/.test(p.id))); assert.equal(new Set(profiles.map(p => p.id)).size, 120);
});
test("similarity is derived from records: acne = 65 of 100", () => {
  const r = computeSimilarity(profiles, ["acne"]); assert.deepEqual([r.matching, r.eligibleTotal, r.percent], [65, 100, 65]);
});
test("every topic yields a plausible, reproducible percentage", () => {
  const expected = { acne: 65, pigmentation: 48, "skin-tone": 41, scars: 37, "dark-circles": 52, "social-media-pressure": 71, "appearance-insecurity": 78 };
  for (const c of cats) { const a = computeSimilarity(profiles, [c.slug]), b = computeSimilarity(profiles, [c.slug]); assert.equal(a.percent, expected[c.slug], c.slug); assert.deepEqual(a, b); }
});
test("ineligible profiles are excluded from numerator and denominator", () => {
  const withAll = profiles.filter(p => p.categories.includes("acne")).length;
  assert.ok(withAll > 65); assert.equal(computeSimilarity(profiles, ["acne"]).matching, 65);
});
test("multiple topics = at least one shared (union), unknown topic = 0, empty set = 0%", () => {
  const u = computeSimilarity(profiles, ["acne", "scars"]); const manual = profiles.filter(p => p.eligible && (p.categories.includes("acne") || p.categories.includes("scars"))).length;
  assert.equal(u.matching, manual); assert.equal(computeSimilarity(profiles, ["nope"]).matching, 0); assert.equal(computeSimilarity([], ["acne"]).percent, 0);
});
test("stories: valid topics, unique slugs, every topic covered, substantial and distinct text", () => {
  const slugs = new Set(cats.map(c => c.slug));
  assert.equal(new Set(stories.map(s => s.slug)).size, stories.length);
  for (const s of stories) { assert.ok(s.cats.length && s.cats.every(c => slugs.has(c)), s.slug); assert.ok(s.body.split(/\s+/).length >= 50, s.slug + " too short"); if (s.image) assert.ok(existsSync(new URL(`../public${s.image}`, import.meta.url)), s.image); }
  for (const c of cats) assert.ok(stories.some(s => s.cats.includes(c.slug)), "no story for " + c.slug);
  assert.equal(new Set(stories.map(s => s.body)).size, stories.length);
});
