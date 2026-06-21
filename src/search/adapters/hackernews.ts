// Hacker News via the Algolia API — developer discussion, rock-solid, no key.
import { fetchJson } from "../../http";
import { domainOf } from "../../util";
import type { Article } from "../../types";

export const name = "hackernews";

interface HnHit {
  objectID?: string;
  title?: string;
  url?: string;
  story_text?: string;
  created_at?: string;
  points?: number;
  num_comments?: number;
}
interface HnResp {
  hits?: HnHit[];
}

export async function search(query: string): Promise<Article[]> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=12`;
  const data = await fetchJson<HnResp>(url, { timeoutMs: 15_000 });
  const hits = data?.hits ?? [];
  return hits.flatMap((h) => {
    if (!h.title) return [];
    const link = h.url ?? (h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : undefined);
    if (!link) return [];
    const meta = `${h.points ?? 0} points · ${h.num_comments ?? 0} comments on Hacker News`;
    const body = h.story_text ? h.story_text.replace(/<[^>]*>/g, " ") : meta;
    return [
      {
        title: h.title.trim(),
        url: link,
        source: "hackernews",
        snippet: body.replace(/\s+/g, " ").slice(0, 400).trim(),
        publishedAt: h.created_at,
        domain: h.url ? domainOf(h.url) : "news.ycombinator.com",
      },
    ];
  });
}
