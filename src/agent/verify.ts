// VERIFY: claim-to-source traceability + hallucination guard (BUILD_SPEC §7.2).
// Checks each factual claim in the draft against the cited source's actual text.
import type { Article } from "../types";
import { completeJson } from "./llmJson";
import { numberedSources } from "./draft";

export interface ClaimCheck {
  claim: string;
  citedSources: string[]; // e.g. ["S2","S5"]
  supported: boolean;
  reason: string;
}

export async function verifyDraft(draftMd: string, articles: Article[]): Promise<ClaimCheck[]> {
  const sources = numberedSources(articles, 1200);
  const prompt =
    `You are fact-checking a draft against its sources.\n\nSOURCES:\n${sources}\n\nDRAFT:\n${draftMd}\n\n` +
    `Extract every FACTUAL claim in the draft. For each, decide if the cited [S#] source(s) actually ` +
    `support it. A claim is UNSUPPORTED if it has no [S#] citation, or the cited source does not back it.\n` +
    `Return JSON: {"claims":[{"claim":"...","citedSources":["S#"],"supported":true|false,"reason":"..."}]}`;
  const r = await completeJson<{ claims?: ClaimCheck[] }>(prompt, {
    system: "You are a rigorous, skeptical fact-checker. Default to unsupported when in doubt.",
  });
  return (r?.claims ?? []).map((c) => ({
    claim: String(c.claim ?? ""),
    citedSources: Array.isArray(c.citedSources) ? c.citedSources.map(String) : [],
    supported: Boolean(c.supported),
    reason: String(c.reason ?? ""),
  }));
}
