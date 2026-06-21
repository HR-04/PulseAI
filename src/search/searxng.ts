// SearXNG — whole-web search, $0, no key (BUILD_SPEC §5.1). Local-only; if the
// container isn't running, fetchJson returns null and we yield [] gracefully.
import { config } from "../config";
import { fetchJson } from "../http";
import { domainOf, toIso } from "../util";
import type { Article } from "../types";

interface SearxResult {
  url?: string;
  title?: string;
  content?: string;
  engine?: string;
  publishedDate?: string;
}
interface SearxResponse {
  results?: SearxResult[];
}

export async function search(query: string): Promise<Article[]> {
  const url = `${config.SEARXNG_URL}/search?q=${encodeURIComponent(query)}&format=json`;
  const data = await fetchJson<SearxResponse>(url, { timeoutMs: 20_000, ttlMs: 60 * 60 * 1000 });
  if (!data?.results?.length) return [];
  return data.results
    .filter((r): r is SearxResult & { url: string; title: string } => Boolean(r.url && r.title))
    .slice(0, config.RESULTS_PER_QUERY * 2)
    .map((r) => ({
      title: r.title.trim(),
      url: r.url,
      source: "searxng",
      snippet: (r.content ?? "").trim(),
      publishedAt: toIso(r.publishedDate),
      domain: domainOf(r.url),
    }));
}
