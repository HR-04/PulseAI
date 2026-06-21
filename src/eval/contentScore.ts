// Content quality rubric (Phase 2 self-improvement). Strict LLM judge scoring a
// blog draft against the reader's SEARCH INTENT. onTopic is weighted highest
// because precision-to-search is the whole point.
import { completeJson } from "../agent/llmJson";
import { clamp } from "../util";

export type ContentDim = "onTopic" | "value" | "grounding" | "structure" | "voice";

export interface ContentScore {
  onTopic: number;
  value: number;
  grounding: number;
  structure: number;
  voice: number;
  overall: number;
  weakest: ContentDim;
  critique: string;
}

const DIMS: ContentDim[] = ["onTopic", "value", "grounding", "structure", "voice"];

export async function scoreContent(
  searchIntent: string,
  draft: string,
  sourcesBrief: string,
): Promise<ContentScore> {
  const prompt =
    `You are grading a blog draft against a reader's SEARCH INTENT. Grade strictly; ` +
    `reserve 90+ for genuinely excellent, on-intent writing.\n\n` +
    `SEARCH INTENT: "${searchIntent}"\n\n` +
    `Score 0-100 on EACH dimension:\n` +
    `- onTopic: does it directly, precisely answer the intent (what a loop is, how to ` +
    `build a good one, best practices)? Penalize HARD any drift into general "agentic AI", ` +
    `architectures, taxonomies, or survey-summarizing that doesn't serve the intent.\n` +
    `- value: concrete, specific, actionable, non-obvious — not generic filler.\n` +
    `- grounding: claims supported (cited) and not fabricated, given the sources.\n` +
    `- structure: strong hook, logical flow, clear headings, crisp takeaway.\n` +
    `- voice: confident and engaging, NOT a hedged "the sources say..." literature dump.\n\n` +
    `SOURCE TITLES (for grounding context):\n${sourcesBrief}\n\nDRAFT:\n${draft}\n\n` +
    `Return JSON: {"onTopic":n,"value":n,"grounding":n,"structure":n,"voice":n,` +
    `"critique":"specific, prioritized fixes targeting the lowest dimensions"}`;

  const r = await completeJson<Partial<ContentScore>>(prompt, {
    system: "You are a demanding editor-in-chief. Be specific and strict.",
  });

  const s = {
    onTopic: clamp(Number(r?.onTopic) || 0),
    value: clamp(Number(r?.value) || 0),
    grounding: clamp(Number(r?.grounding) || 0),
    structure: clamp(Number(r?.structure) || 0),
    voice: clamp(Number(r?.voice) || 0),
  };
  // onTopic 40% (the user's core complaint), then value/grounding 20% each.
  const overall = clamp(
    Math.round(0.4 * s.onTopic + 0.2 * s.value + 0.2 * s.grounding + 0.12 * s.structure + 0.08 * s.voice),
  );
  const weakest = DIMS.reduce((a, b) => (s[a] <= s[b] ? a : b));
  return { ...s, overall, weakest, critique: String(r?.critique ?? "") };
}
