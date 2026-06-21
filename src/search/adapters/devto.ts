// Dev.to — developer blogs, no key. The public API is tag-based, so we derive a
// tag from the query (approximate, but matches the adapter contract).
import { fetchJson } from "../../http";
import { toIso } from "../../util";
import type { Article } from "../../types";

export const name = "devto";

interface DevArticle {
  title?: string;
  url?: string;
  description?: string;
  published_at?: string;
}

const KNOWN_TAGS = [
  "llm", "ai", "machinelearning", "datascience", "nlp", "chatgpt", "openai",
  "rag", "genai", "python", "webdev", "programming", "devops", "security",
];

// Map a query to a single sensible Dev.to tag (the API is tag-based).
function pickTag(q: string): string {
  const s = q.toLowerCase();
  if (/language model|\bllm\b|\bgpt\b/.test(s)) return "llm";
  for (const t of KNOWN_TAGS) if (new RegExp(`\\b${t}\\b`).test(s)) return t;
  if (/machine learning/.test(s)) return "machinelearning";
  if (/\bai\b|artificial intelligence/.test(s)) return "ai";
  return s.match(/[a-z0-9]{4,}/g)?.[0] ?? "ai";
}

export async function search(query: string): Promise<Article[]> {
  const tag = pickTag(query);
  const url = `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=10&top=30`;
  const data = await fetchJson<DevArticle[]>(url, { timeoutMs: 15_000 });
  if (!Array.isArray(data)) return [];
  return data.flatMap((a) =>
    a.title && a.url
      ? [
          {
            title: a.title.trim(),
            url: a.url,
            source: "devto",
            snippet: (a.description ?? "").trim(),
            publishedAt: toIso(a.published_at),
            domain: "dev.to",
          },
        ]
      : [],
  );
}
