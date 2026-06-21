// Drop duplicate URLs and near-identical titles before the (expensive) extract
// + score stages. Keeps the first occurrence.
import type { Article } from "./types";

function normUrl(u: string): string {
  try {
    const url = new URL(u);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
}

function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function dedupe(articles: Article[]): Article[] {
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const out: Article[] = [];
  for (const a of articles) {
    const u = normUrl(a.url);
    if (seenUrl.has(u)) continue;
    const t = normTitle(a.title);
    if (t.length > 12 && seenTitle.has(t)) continue;
    seenUrl.add(u);
    if (t.length > 12) seenTitle.add(t);
    out.push(a);
  }
  return out;
}
