import { slugify as baseSlugify } from "@iedora/common";

// Slug rules — 2–40 chars, lowercase
// alphanumerics and single dashes, starting and ending alphanumeric. Globally
// unique across restaurants.
const MIN_SLUG_LEN = 2;
const MAX_SLUG_LEN = 40;
const slugPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** True if s is an acceptable restaurant slug as-is. */
export function validSlug(s: string): boolean {
  return (
    s.length >= MIN_SLUG_LEN && s.length <= MAX_SLUG_LEN && slugPattern.test(s) && !s.includes("--")
  );
}

// slugify derives a slug candidate from a display name, within the length rules.
// Returns "" when nothing usable (or too short) remains (caller falls back to a
// generated id).
export function slugify(name: string): string {
  return baseSlugify(name, { maxLen: MAX_SLUG_LEN, minLen: MIN_SLUG_LEN, fallback: "" });
}

// numbered returns the n-th collision candidate ("tasca", "tasca-2", …), within
// the length limit.
export function numbered(base: string, n: number): string {
  if (n <= 1) return base;
  const suffix = `-${n}`;
  if (base.length + suffix.length > MAX_SLUG_LEN) {
    base = trimDashes(base.slice(0, MAX_SLUG_LEN - suffix.length));
  }
  return base + suffix;
}

function trimDashes(s: string): string {
  return s.replace(/^-+/, "").replace(/-+$/, "");
}
