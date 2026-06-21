// Live check of the search + ingest layer (no SearXNG container required — that
// source just yields [] if it's not running). Run: npm run test:search
import { gather } from "./search/index";
import { dedupe } from "./dedupe";
import { rank } from "./rank";
import { extractArticle } from "./extract";
import { log } from "./log";

const query = process.argv[2] ?? "large language models";
log.step(`gather "${query}"`);

const raw = await gather([query]);
log.info(`raw results: ${raw.length}`);

const bySource = raw.reduce<Record<string, number>>((m, a) => {
  m[a.source] = (m[a.source] ?? 0) + 1;
  return m;
}, {});
log.info("by source", bySource);

const unique = dedupe(raw);
log.info(`after dedupe: ${unique.length}`);

const top = rank(unique, 5);
log.step("top 5 ranked:");
for (const a of top) console.log(`   • [${a.domain}] ${a.title}`);

if (top[0]) {
  log.step(`extract test on: ${top[0].url}`);
  const ex = await extractArticle(top[0]);
  log.ok(ex.fullText ? `full text: ${ex.fullText.length} chars` : "no full text (snippet fallback)");
}
