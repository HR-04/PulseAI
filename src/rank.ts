// Order survivors by a blend of domain trust, whether we got full text, and
// recency. Returns the top N for synthesis.
import type { Article } from "./types";
import { domainTrust } from "./quality/trust";
import { ageInDays } from "./util";

function scoreOne(a: Article): number {
  let s = domainTrust(a.domain); // 0..100 base
  if (a.fullText && a.fullText.length > 500) s += 12; // we actually read it
  else if (a.snippet && a.snippet.length > 80) s += 4;

  const age = ageInDays(a.publishedAt);
  if (age !== undefined) {
    if (age < 30) s += 8;
    else if (age < 180) s += 4;
    else if (age > 365 * 3) s -= 6;
  }
  return s;
}

export function rank(articles: Article[], top = 12): Article[] {
  return articles
    .map((a) => ({ a, s: scoreOne(a) }))
    .sort((x, y) => y.s - x.s)
    .slice(0, top)
    .map((x) => x.a);
}
