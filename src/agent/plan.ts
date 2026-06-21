// PLAN: topic → focused sub-queries, and refinement on a NO decision (targeting
// the weakest scoring dimension). BUILD_SPEC §3 / §12.4.
import type { Mode } from "../types";
import { completeJson } from "./llmJson";
import { log } from "../log";

interface PlanResult {
  subQueries?: string[];
}

const SYS: Record<Mode, string> = {
  content:
    "You are a research strategist. Decompose a topic into focused, diverse web-search queries that together give comprehensive coverage — different angles, not rephrasings.",
  "market-intel":
    "You are a market-research analyst. Decompose a market/topic into queries that surface pain points, competitor moves, pricing, adoption, and buyer sentiment.",
};

export async function planQueries(topic: string, mode: Mode, count = 5): Promise<string[]> {
  const prompt =
    `Topic: "${topic}"\nMode: ${mode}\n\n` +
    `Produce ${count} focused web-search queries that together cover the topic ` +
    `comprehensively (distinct angles). JSON: {"subQueries":["...", ...]}.`;
  const r = await completeJson<PlanResult>(prompt, { system: SYS[mode] });
  const qs = (r?.subQueries ?? []).map((s) => s.trim()).filter(Boolean).slice(0, count);
  const result = qs.length ? qs : [topic];
  log.info(`planned ${result.length} sub-queries`, result);
  return result;
}

export async function refineQueries(
  topic: string,
  mode: Mode,
  weakest: string,
  answered: string[],
  unanswered: string[],
  count = 3,
): Promise<string[]> {
  const prompt =
    `Topic: "${topic}". The research is weakest on: ${weakest}.\n` +
    `Already answered: ${JSON.stringify(answered)}\n` +
    `Still weak/unanswered: ${JSON.stringify(unanswered)}\n\n` +
    `Produce ${count} NEW queries that specifically strengthen "${weakest}" and the ` +
    `unanswered angles (different from the answered ones). JSON: {"subQueries":["..."]}.`;
  const r = await completeJson<PlanResult>(prompt, {
    system: SYS[mode] + " You are refining the plan to fix its weakest dimension.",
  });
  const qs = (r?.subQueries ?? []).map((s) => s.trim()).filter(Boolean).slice(0, count);
  const result = qs.length ? qs : unanswered.slice(0, count);
  log.info(`refined ${result.length} sub-queries (weakest: ${weakest})`, result);
  return result;
}
