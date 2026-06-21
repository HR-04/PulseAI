// Generic RSS — any feed the user supplies via GENERIC_RSS_URLS (comma-separated
// in .env). Inert if unset. Query-independent (a feed is a feed); the input gate
// and ranker decide relevance downstream.
import { fetchText } from "../../http";
import { parseRss } from "../rss";
import { domainOf, toIso } from "../../util";
import type { Article } from "../../types";

export const name = "genericrss";

export async function search(_query: string): Promise<Article[]> {
  const urls = (process.env.GENERIC_RSS_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!urls.length) return [];

  const out: Article[] = [];
  for (const feed of urls) {
    const xml = await fetchText(feed, { timeoutMs: 15_000 });
    if (!xml) continue;
    for (const it of parseRss(xml).slice(0, 8)) {
      out.push({
        title: it.title,
        url: it.link,
        source: "rss",
        snippet: it.description ?? "",
        publishedAt: toIso(it.pubDate),
        domain: domainOf(it.link),
      });
    }
  }
  return out;
}
