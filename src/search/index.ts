// Source registry + aggregator. Adding a source later = one new adapter file
// with `search(query)` + one line here. Nothing else changes (BUILD_SPEC §5.2).
//
// Sources are tagged by query style: "verbose" sources (web/news) handle the
// planner's long natural-language sub-queries; "keyword" sources (HN/Reddit/Dev.to)
// need short keyword queries or they match nothing.
import type { Article } from "../types";
import { mapLimit } from "../util";
import { log } from "../log";
import { search as searxng } from "./searxng";
import * as googleNews from "./adapters/googleNews";
import * as reddit from "./adapters/reddit";
import * as hackernews from "./adapters/hackernews";
import * as devto from "./adapters/devto";
import * as genericRss from "./adapters/genericRss";

export type QueryStyle = "verbose" | "keyword";

export interface Source {
  name: string;
  style: QueryStyle;
  search: (q: string) => Promise<Article[]>;
}

export const SOURCES: Source[] = [
  { name: "searxng", style: "verbose", search: searxng },
  { name: googleNews.name, style: "verbose", search: googleNews.search },
  { name: genericRss.name, style: "verbose", search: genericRss.search },
  { name: hackernews.name, style: "keyword", search: hackernews.search },
  { name: reddit.name, style: "keyword", search: reddit.search },
  { name: devto.name, style: "keyword", search: devto.search },
];

/**
 * Run every source over the appropriate queries, concurrently, and flatten.
 * Verbose sources get `queries`; keyword sources get `keywordQueries` (falls
 * back to `queries` if none supplied). Never throws.
 */
export async function gather(
  queries: string[],
  opts?: { keywordQueries?: string[] },
): Promise<Article[]> {
  const keyword = opts?.keywordQueries?.length ? opts.keywordQueries : queries;
  const tasks: { q: string; src: Source }[] = [];
  for (const src of SOURCES) {
    const qs = src.style === "keyword" ? keyword : queries;
    for (const q of qs) tasks.push({ q, src });
  }

  const batches = await mapLimit(tasks, 6, async ({ q, src }) => {
    try {
      const r = await src.search(q);
      log.debug(`${src.name} "${q}" → ${r.length}`);
      return r;
    } catch (e) {
      log.debug(`${src.name} "${q}" failed`, (e as Error).message);
      return [] as Article[];
    }
  });
  return batches.flat();
}
