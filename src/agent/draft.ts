// DRAFT: outline → draft → self-critique → revise (BUILD_SPEC §12.2.1). All text
// comes from the AIS model, grounded ONLY in the notebook entry's sources. The
// draft must cite sources inline as [S#] so the output gate can verify them.
import type { Article, ResearchResult } from "../types";
import { getLLM } from "../llm";
import { log } from "../log";

const WRITER = "You are a senior technical writer. Ground every factual statement in the " +
  "provided sources and cite them inline as [S#]. Never invent facts or sources. Do not call any tools.";

/** Number the sources [S1..Sn] so the draft and the verifier share one indexing. */
export function numberedSources(articles: Article[], perSource = 1500): string {
  return articles
    .map((a, i) => `[S${i + 1}] ${a.title} — ${a.url}\n${(a.fullText ?? a.snippet ?? "").slice(0, perSource)}`)
    .join("\n\n");
}

export async function draft(r: ResearchResult): Promise<string> {
  const llm = getLLM();
  const sources = numberedSources(r.articles);
  const claims = r.synthesis.keyClaims.map((c) => `- ${c.claim}`).join("\n");

  log.step("draft: outlining");
  const outline = await llm.complete(
    `Blog topic: "${r.topic}"\nThesis: ${r.synthesis.thesis}\nKey claims:\n${claims}\n\n` +
      `Produce a tight outline (5–7 sections) for an engaging, technical-but-accessible blog post. ` +
      `Return just the outline.`,
    { system: WRITER },
  );

  log.step("draft: writing");
  const text = await llm.complete(
    `Write a full blog post in Markdown on "${r.topic}" following this outline:\n${outline}\n\n` +
      `Thesis: ${r.synthesis.thesis}\n\nSOURCES (cite inline as [S#] wherever you state a fact):\n${sources}\n\n` +
      `Rules: strong hook; clear sections with ## headings; every factual claim cites at least one [S#]; ` +
      `end with a takeaway. Do not invent facts or sources.`,
    { system: WRITER },
  );

  log.step("draft: self-critiquing");
  const critique = await llm.complete(
    `Critique this draft. Flag: (a) any statement lacking an [S#] citation, (b) weak/filler sections, ` +
      `(c) unclear passages. Be specific; list concrete fixes.\n\nDRAFT:\n${text}`,
    { system: "You are a tough, specific editor. Do not call any tools." },
  );

  log.step("draft: revising");
  const revised = await llm.complete(
    `Revise the draft to address this critique. Keep every factual claim tied to an [S#]; ` +
      `cut anything unsupported or filler. Output ONLY the revised Markdown.\n\n` +
      `CRITIQUE:\n${critique}\n\nDRAFT:\n${text}`,
    { system: WRITER },
  );

  log.ok("draft complete (outline → draft → critique → revise)");
  return revised.trim();
}
