// SYNTHESIZE: turn the surviving sources into a point of view — thesis, claims
// (each mapped to source URLs), agreements, conflicts, novelty. BUILD_SPEC §6/§12.9.
import type { Article, Mode, Synthesis } from "../types";
import { completeJson } from "./llmJson";
import { log } from "../log";

export async function synthesize(topic: string, mode: Mode, articles: Article[]): Promise<Synthesis> {
  const corpus = articles
    .slice(0, 12)
    .map((a, i) => `[S${i + 1}] ${a.title}\nURL: ${a.url}\n${(a.fullText ?? a.snippet ?? "").slice(0, 1200)}`)
    .join("\n\n---\n\n");

  const strict =
    mode === "market-intel"
      ? "\nMARKET-INTEL MODE: every claim MUST be backed by at least one source URL; " +
        "prefer claims with direct supporting evidence."
      : "";

  const prompt =
    `Topic: "${topic}"\n\nSources:\n${corpus}\n\n` +
    `Synthesize into JSON with EXACTLY this shape:\n` +
    `{\n` +
    `  "thesis": "a clear point of view (1-2 sentences)",\n` +
    `  "keyClaims": [{"claim":"...","sourceUrls":["..."]}],\n` +
    `  "agreements": ["points most sources agree on"],\n` +
    `  "disagreements": ["where sources conflict"],\n` +
    `  "whatsNew": ["genuinely novel vs. recycled"]\n` +
    `}\n` +
    `Use ONLY the sources above and cite their URLs in sourceUrls. Do not invent facts.${strict}`;

  const r = await completeJson<Synthesis>(prompt, {
    system: "You are a rigorous research synthesist who never fabricates.",
  });

  const synthesis: Synthesis = {
    thesis: r?.thesis?.trim() ?? "",
    keyClaims: Array.isArray(r?.keyClaims) ? r.keyClaims.filter((c) => c?.claim) : [],
    agreements: r?.agreements ?? [],
    disagreements: r?.disagreements ?? [],
    whatsNew: r?.whatsNew ?? [],
  };
  log.ok(
    `synthesis: ${synthesis.keyClaims.length} claims, ` +
      `${synthesis.disagreements.length} conflicts, thesis ${synthesis.thesis ? "set" : "MISSING"}`,
  );
  return synthesis;
}
