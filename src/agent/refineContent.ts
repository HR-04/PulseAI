// Content self-improvement loop: generate → score → refine the weakest dimension
// → repeat until overall ≥ target / max rounds / plateau. Keeps the BEST draft
// (not the last — the lesson from Phase 1's 74→70 regression).
import type { ResearchResult } from "../types";
import { getLLM } from "../llm";
import { numberedSources } from "./draft";
import { scoreContent, type ContentScore } from "../eval/contentScore";
import { log } from "../log";

const WRITER =
  "You are a world-class technical writer with a confident, engaging voice. Stay laser-" +
  "focused on the reader's search intent — do NOT pad with general background or survey " +
  "summaries. Ground factual claims in the provided sources and cite them inline as [S#]. " +
  "Never invent facts or sources. Do not call any tools.";

export interface RefineResult {
  draft: string;
  score: ContentScore;
  rounds: number;
  history: ContentScore[];
}

export async function refineBlog(
  r: ResearchResult,
  searchIntent: string,
  opts?: { target?: number; maxRounds?: number },
): Promise<RefineResult> {
  const llm = getLLM();
  const target = opts?.target ?? 90;
  const maxRounds = opts?.maxRounds ?? 4;
  const sources = numberedSources(r.articles);
  const sourcesBrief = r.articles.map((a, i) => `[S${i + 1}] ${a.title}`).join("\n");

  log.step("refine: initial focused draft");
  let draft = (
    await llm.complete(
      `Write an excellent blog post that DIRECTLY answers this reader's search: "${searchIntent}".\n\n` +
        `Cover, in order: (1) what a loop IS in this context and why one-shot isn't enough, ` +
        `(2) how to CREATE a good loop — concrete steps, (3) best practices, (4) anti-patterns to avoid. ` +
        `Stay laser-focused on LOOPS; do NOT drift into general agentic-AI architecture or survey dumps.\n\n` +
        `Strong hook, ## sections, concrete examples, a punchy takeaway. Cite facts inline as [S#].\n\n` +
        `SOURCES:\n${sources}`,
      { system: WRITER },
    )
  ).trim();

  const history: ContentScore[] = [];
  let best = draft;
  let bestScore: ContentScore | null = null;
  let prev: number | null = null;
  let round = 0;

  for (;;) {
    round++;
    const score = await scoreContent(searchIntent, draft, sourcesBrief);
    history.push(score);
    log.info(`refine round ${round} → overall ${score.overall}`, {
      onTopic: score.onTopic, value: score.value, grounding: score.grounding,
      structure: score.structure, voice: score.voice, weakest: score.weakest,
    });
    if (!bestScore || score.overall > bestScore.overall) {
      best = draft;
      bestScore = score;
    }
    if (score.overall >= target) { log.ok(`refine stop: ${score.overall} ≥ ${target}`); break; }
    if (round >= maxRounds) { log.ok(`refine stop: max rounds (${maxRounds})`); break; }
    if (prev !== null && score.overall - prev < 3) { log.ok(`refine stop: plateau`); break; }
    prev = score.overall;

    log.step(`refine: improving weakest "${score.weakest}"`);
    draft = (
      await llm.complete(
        `Improve this blog draft. Its weakest dimension is "${score.weakest}".\n` +
          `Editor critique to address:\n${score.critique}\n\n` +
          `Stay laser-focused on the search intent: "${searchIntent}". Keep [S#] citations for facts; ` +
          `do not invent sources. Output ONLY the improved Markdown.\n\nDRAFT:\n${draft}`,
        { system: WRITER },
      )
    ).trim();
  }

  return { draft: best, score: bestScore as ContentScore, rounds: round, history };
}
