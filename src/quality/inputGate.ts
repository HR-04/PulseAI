// INPUT GATE (before extraction): drop denied domains, stale items (non-evergreen),
// and obvious slop. Tiered trust lives in trust.ts. BUILD_SPEC §7.1.
//
// Note: a cheap-LLM "is this low quality?" classify for borderline cases is an
// intentional optional hook — left out of the default path to keep latency/cost
// down. Wire it here if borderline volume warrants it.
import type { Article } from "../types";
import { config } from "../config";
import { isDenied } from "./trust";
import { ageInDays } from "../util";
import { log } from "../log";

const SLOP_PATTERNS = [
  /\bclick here\b/i,
  /\bsponsored content\b/i,
  /\bbuy now\b/i,
  /\bcheap\b.*\bdeals?\b/i,
];

export interface Rejection {
  url: string;
  reason: string;
}
export interface GateResult {
  kept: Article[];
  rejected: Rejection[];
}

export function inputGate(
  articles: Article[],
  opts?: { evergreen?: boolean; freshnessDays?: number },
): GateResult {
  const kept: Article[] = [];
  const rejected: Rejection[] = [];
  const freshness = opts?.freshnessDays ?? config.FRESHNESS_DAYS;

  for (const a of articles) {
    if (isDenied(a.domain)) {
      rejected.push({ url: a.url, reason: `denied-domain:${a.domain || "unparseable"}` });
      continue;
    }
    if (!a.title || a.title.trim().length < 8) {
      rejected.push({ url: a.url, reason: "thin-title" });
      continue;
    }
    if (!opts?.evergreen) {
      const age = ageInDays(a.publishedAt);
      if (age !== undefined && age > freshness) {
        rejected.push({ url: a.url, reason: `stale:${Math.round(age)}d` });
        continue;
      }
    }
    if (SLOP_PATTERNS.some((re) => re.test(`${a.title} ${a.snippet}`))) {
      rejected.push({ url: a.url, reason: "slop-heuristic" });
      continue;
    }
    kept.push(a);
  }

  log.info(`input gate: kept ${kept.length}, rejected ${rejected.length}`);
  return { kept, rejected };
}
