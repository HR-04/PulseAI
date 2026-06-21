// Google News RSS — current news, no key. Each item carries the real publisher
// in <source url="...">, which we use for the reputation domain.
import { fetchText } from "../../http";
import { parseRss } from "../rss";
import { domainOf, toIso } from "../../util";
import type { Article } from "../../types";

export const name = "googlenews";

export async function search(query: string): Promise<Article[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchText(url, {
    timeoutMs: 15_000,
    accept: "application/rss+xml,application/xml,text/xml",
  });
  if (!xml) return [];
  return parseRss(xml)
    .slice(0, 12)
    .map((it) => ({
      title: it.title,
      url: it.link,
      source: "googlenews",
      snippet: it.description ?? "",
      publishedAt: toIso(it.pubDate),
      domain: (it.sourceUrl ? domainOf(it.sourceUrl) : domainOf(it.link)) || "news.google.com",
    }));
}
