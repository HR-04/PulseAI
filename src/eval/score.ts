// EVALUATION HARNESS → researchScore (BUILD_SPEC §9). Deterministic where it can
// be (trust, diversity, recency); one LLM call judges coverage. Persists a
// per-run scorecard + rolling history to output/eval-reports/.
import { appendFile, mkdir } from "node:fs/promises";
import type { Article, Mode } from "../types";
import { config } from "../config";
import { domainTrust } from "../quality/trust";
import { ageInDays, clamp, slugify, writeJson } from "../util";
import { completeJson } from "../agent/llmJson";

export type Dimension = "sourceQuality" | "diversity" | "coverage" | "recency";

export interface PerQuery {
  query: string;
  answered: boolean;
  strength: number;
}

export interface ScoreBreakdown {
  sourceQuality: number;
  diversity: number;
  coverage: number;
  recency: number;
  researchScore: number;
  perQuery: PerQuery[];
  weakest: Dimension;
}

const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (n: number): number => Math.round(n);

function diversityScore(articles: Article[]): number {
  if (!articles.length) return 0;
  const domains = new Set(articles.map((a) => a.domain)).size;
  const sources = new Set(articles.map((a) => a.source)).size;
  const domainScore = clamp((domains / articles.length) * 120);
  const sourceScore = clamp((sources / 5) * 100);
  return clamp(0.6 * domainScore + 0.4 * sourceScore);
}

function recencyScore(articles: Article[]): number {
  const ages = articles
    .map((a) => ageInDays(a.publishedAt))
    .filter((x): x is number => x !== undefined);
  if (!ages.length) return 60; // neutral when dates are unknown
  return avg(ages.map((d) => (d < 30 ? 100 : d < 180 ? 80 : d < 365 ? 60 : d < 730 ? 40 : 20)));
}

async function coverageScore(
  subQueries: string[],
  articles: Article[],
): Promise<{ coverage: number; perQuery: PerQuery[] }> {
  if (!subQueries.length || !articles.length) return { coverage: 0, perQuery: [] };
  const corpus = articles
    .slice(0, 15)
    .map((a, i) => `[${i + 1}] (${a.domain}) ${a.title} — ${a.snippet.slice(0, 160)}`)
    .join("\n");
  const prompt =
    `Sub-queries:\n${subQueries.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\n` +
    `Sources found:\n${corpus}\n\n` +
    `For EACH sub-query, judge whether these sources collectively answer it. ` +
    `JSON: {"perQuery":[{"query":"...","answered":true|false,"strength":0-100}]}.`;
  const r = await completeJson<{ perQuery?: PerQuery[] }>(prompt, {
    system: "You evaluate research coverage strictly and honestly.",
  });
  const perQuery = (r?.perQuery ?? []).map((p) => ({
    query: String(p.query ?? ""),
    answered: Boolean(p.answered),
    strength: clamp(Number(p.strength) || 0),
  }));
  if (!perQuery.length) {
    // heuristic fallback if the judge call failed
    return { coverage: clamp(Math.min(100, articles.length * 8)), perQuery: [] };
  }
  return { coverage: avg(perQuery.map((p) => p.strength)), perQuery };
}

export async function scoreResearch(
  topic: string,
  mode: Mode,
  subQueries: string[],
  articles: Article[],
): Promise<ScoreBreakdown> {
  const sourceQuality = avg(articles.map((a) => domainTrust(a.domain)));
  const diversity = diversityScore(articles);
  const recency = recencyScore(articles);
  const { coverage, perQuery } = await coverageScore(subQueries, articles);

  // Weighted blend (BUILD_SPEC §9): quality + diversity + coverage + recency.
  const researchScore = clamp(
    round(0.35 * sourceQuality + 0.2 * diversity + 0.35 * coverage + 0.1 * recency),
  );

  const dims: Record<Dimension, number> = { sourceQuality, diversity, coverage, recency };
  const weakest = (Object.keys(dims) as Dimension[]).sort((a, b) => dims[a] - dims[b])[0] as Dimension;

  return {
    sourceQuality: round(sourceQuality),
    diversity: round(diversity),
    coverage: round(coverage),
    recency: round(recency),
    researchScore,
    perQuery,
    weakest,
  };
}

export async function saveScorecard(record: {
  topic: string;
  mode: Mode;
  createdAt: string;
  finalScore: number;
  sourceCount: number;
  rounds: unknown[];
}): Promise<void> {
  const file = `output/eval-reports/${record.createdAt.slice(0, 10)}-${slugify(record.topic)}.json`;
  await writeJson(file, record);
  // append a compact line to the rolling history
  try {
    await mkdir("output/eval-reports", { recursive: true });
    const line = JSON.stringify({
      createdAt: record.createdAt,
      topic: record.topic,
      mode: record.mode,
      finalScore: record.finalScore,
      rounds: record.rounds.length,
      sourceCount: record.sourceCount,
    });
    await appendFile("output/eval-reports/history.jsonl", line + "\n", "utf8");
  } catch {
    // history is best-effort
  }
}
