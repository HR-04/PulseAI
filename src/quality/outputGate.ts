// OUTPUT GATE (before publish): run the claim verifier, compute factualSupport,
// and rewrite the draft to remove unsupported claims so nothing unsupported ships
// (BUILD_SPEC §7.2). Market-intel is held to a stricter bar.
import type { Article, Mode, ResearchResult } from "../types";
import { getLLM } from "../llm";
import { verifyDraft, type ClaimCheck } from "../agent/verify";
import { clamp } from "../util";
import { log } from "../log";

export interface GateOutput {
  cleanDraft: string;
  factualSupport: number; // 0–100, % of claims supported
  checks: ClaimCheck[];
  unsupported: ClaimCheck[];
}

export async function runOutputGate(draftMd: string, r: ResearchResult): Promise<GateOutput> {
  log.step("output gate: verifying claims against sources");
  const checks = await verifyDraft(draftMd, r.articles);
  const unsupported = checks.filter((c) => !c.supported);
  const factualSupport = checks.length
    ? clamp(Math.round((checks.filter((c) => c.supported).length / checks.length) * 100))
    : 0;
  log.info(`claims: ${checks.length}, supported: ${checks.length - unsupported.length}, factualSupport: ${factualSupport}`);

  let cleanDraft = draftMd;
  if (unsupported.length) {
    log.warn(`removing ${unsupported.length} unsupported claim(s)`);
    const strict = r.mode === ("market-intel" as Mode)
      ? " (MARKET-INTEL: an insight with no direct quote+link must be dropped entirely.)"
      : "";
    cleanDraft = (
      await getLLM().complete(
        `Rewrite this blog draft to REMOVE or soften every unsupported claim listed below, ` +
          `keeping it coherent. Do not add new facts. Output only the cleaned Markdown.${strict}\n\n` +
          `UNSUPPORTED CLAIMS:\n${unsupported.map((u) => `- ${u.claim} (${u.reason})`).join("\n")}\n\n` +
          `DRAFT:\n${draftMd}`,
        { system: "You are an editor enforcing claim-to-source integrity. Do not call any tools." },
      )
    ).trim();
  }

  return { cleanDraft, factualSupport, checks, unsupported };
}
