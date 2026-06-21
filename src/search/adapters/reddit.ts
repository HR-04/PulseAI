// Reddit search — real opinions / pain points. Keyless .json endpoint; Reddit
// may rate-limit/403 unauthenticated callers, in which case fetchJson returns
// null and we yield [] (best-effort source, never the pipeline's backbone).
import { fetchJson } from "../../http";
import { isoFromEpochSeconds } from "../../util";
import type { Article } from "../../types";

export const name = "reddit";

interface RedditChild {
  data?: {
    title?: string;
    url?: string;
    permalink?: string;
    selftext?: string;
    created_utc?: number;
  };
}
interface RedditResp {
  data?: { children?: RedditChild[] };
}

export async function search(query: string): Promise<Article[]> {
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=12&sort=relevance&t=year`;
  const data = await fetchJson<RedditResp>(url, { timeoutMs: 15_000 });
  const children = data?.data?.children ?? [];
  return children.flatMap((c) => {
    const d = c.data;
    if (!d?.title) return [];
    const link = d.permalink ? `https://www.reddit.com${d.permalink}` : d.url;
    if (!link) return [];
    return [
      {
        title: d.title.trim(),
        url: link,
        source: "reddit",
        snippet: (d.selftext ?? "").slice(0, 400).trim(),
        publishedAt: isoFromEpochSeconds(d.created_utc),
        domain: "reddit.com",
      },
    ];
  });
}
