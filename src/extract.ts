// Deep full-text extraction via Readability; snippet fallback on any failure
// (paywalls, bot-blocks, JS-only pages). Never throws (BUILD_SPEC §14.2).
import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import { fetchText } from "./http";
import { mapLimit } from "./util";
import { log } from "./log";
import type { Article } from "./types";

const MAX_FULLTEXT = 12_000; // cap to control downstream token use

export async function extractArticle(a: Article): Promise<Article> {
  if (a.fullText) return a; // already extracted in a prior round
  if (!/^https?:\/\//i.test(a.url)) return a;
  const html = await fetchText(a.url, {
    timeoutMs: 15_000,
    accept: "text/html,application/xhtml+xml",
    ttlMs: 24 * 60 * 60 * 1000,
  });
  if (!html) return a; // snippet fallback

  try {
    const virtualConsole = new VirtualConsole(); // swallow page console noise
    const dom = new JSDOM(html, { url: a.url, virtualConsole });
    const parsed = new Readability(dom.window.document).parse();
    dom.window.close();
    const text = parsed?.textContent?.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (text && text.length > 200) {
      return { ...a, title: a.title || parsed?.title || a.title, fullText: text.slice(0, MAX_FULLTEXT) };
    }
  } catch {
    // fall through to snippet fallback
  }
  return a;
}

export async function extractAll(articles: Article[], concurrency = 4): Promise<Article[]> {
  const out = await mapLimit(articles, concurrency, extractArticle);
  const got = out.filter((a) => a.fullText).length;
  log.info(`extracted full text for ${got}/${out.length} sources (rest use snippet)`);
  return out;
}
