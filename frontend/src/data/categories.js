import categories from "./categories.json";
export const CATEGORIES = categories;
export const catBySlug = slug => categories.find(c => c.slug === slug);
export const catName = slug => catBySlug(slug)?.name ?? slug;
/** Accepts a slug or an old display name (e.g. ?cat=Acne) and returns a slug, or null. */
export const toSlug = v => categories.find(c => c.slug === v || c.name === v)?.slug ?? null;
