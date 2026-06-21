// PHASE 1 orchestrator — the self-improving research loop (BUILD_SPEC §3/§4/§12).
//   plan → search → input-gate → dedupe → extract → score → assess
//        → (NO: refine queries, loop) | (YES: synthesize → save to notebook)
// Run: npm run research "your topic" [--mode=market-intel]
import type { Article, Mode, ResearchResult } from "./types";
import { planQueries, refineQueries } from "./agent/plan";
import { gather } from "./search/index";
import { inputGate } from "./quality/inputGate";
import { dedupe } from "./dedupe";
import { extractAll } from "./extract";
import { rank } from "./rank";
import { scoreResearch, saveScorecard, type ScoreBreakdown } from "./eval/score";
import { assess, type Decision } from "./agent/assess";
import { synthesize } from "./agent/synthesize";
import { writeJson, slugify } from "./util";
import { log } from "./log";

interface RoundRecord {
  round: number;
  queries: string[];
  found: number;
  rejected: number;
  score: number;
  breakdown: ScoreBreakdown;
  decision: Decision;
}

function parseArgs(): { topic: string; mode: Mode } {
  const argv = process.argv.slice(2);
  const modeArg = argv.find((a) => a.startsWith("--mode="));
  const mode: Mode = modeArg?.split("=")[1] === "market-intel" ? "market-intel" : "content";
  const topic = argv.filter((a) => !a.startsWith("--")).join(" ").trim();
  if (!topic) {
    console.error('Usage: npm run research "your topic" [--mode=market-intel]');
    process.exit(1);
  }
  return { topic, mode };
}

// Short keyword queries for HN/Reddit/Dev.to: the bare topic + the first few
// words of each verbose sub-query (keyword APIs match nothing on long queries).
function keywordsFrom(topic: string, queries: string[]): string[] {
  const short = (q: string) => q.split(/\s+/).slice(0, 6).join(" ");
  return [...new Set([topic, ...queries.map(short)])].slice(0, 4);
}

async function main(): Promise<void> {
  const { topic, mode } = parseArgs();
  log.step(`PulseAI research — "${topic}" [${mode}]`);

  let queries = await planQueries(topic, mode);
  let pool: Article[] = [];
  let prevScore: number | null = null;
  let round = 0;
  let last: ScoreBreakdown | null = null;
  const rounds: RoundRecord[] = [];

  for (;;) {
    round++;
    log.step(`round ${round}: searching ${queries.length} queries`);

    const found = await gather(queries, { keywordQueries: keywordsFrom(topic, queries) });
    const { kept, rejected } = inputGate(found);
    pool = await extractAll(rank(dedupe([...pool, ...kept]), 18), 4);

    const breakdown = await scoreResearch(topic, mode, queries, pool);
    last = breakdown;
    log.info(`round ${round} → score ${breakdown.researchScore}`, {
      quality: breakdown.sourceQuality,
      diversity: breakdown.diversity,
      coverage: breakdown.coverage,
      recency: breakdown.recency,
      weakest: breakdown.weakest,
    });

    const decision = assess({ round, score: breakdown.researchScore, prevScore });
    rounds.push({ round, queries, found: found.length, rejected: rejected.length, score: breakdown.researchScore, breakdown, decision });

    if (decision.stop) {
      log.ok(`stop: ${decision.reason}`);
      break;
    }

    log.warn(`continue: ${decision.reason}`);
    const answered = breakdown.perQuery.filter((p) => p.answered).map((p) => p.query);
    const unanswered = breakdown.perQuery.filter((p) => !p.answered).map((p) => p.query);
    queries = await refineQueries(topic, mode, breakdown.weakest, answered, unanswered);
    prevScore = breakdown.researchScore;
  }

  const finalPool = rank(pool, 12);
  const synthesis = await synthesize(topic, mode, finalPool);

  const result: ResearchResult = {
    topic,
    mode,
    rounds: round,
    researchScore: last?.researchScore ?? 0,
    articles: finalPool,
    synthesis,
    createdAt: new Date().toISOString(),
  };

  const base = `${result.createdAt.slice(0, 10)}-${slugify(topic)}`;
  await writeJson(`output/notebook/${base}.json`, result);
  await saveScorecard({
    topic,
    mode,
    createdAt: result.createdAt,
    finalScore: result.researchScore,
    sourceCount: finalPool.length,
    rounds,
  });

  log.ok(
    `saved output/notebook/${base}.json — score ${result.researchScore}, ` +
      `${finalPool.length} sources, ${round} round(s)`,
  );
}

main().catch((e) => {
  log.error((e as Error).message);
  process.exit(1);
});
