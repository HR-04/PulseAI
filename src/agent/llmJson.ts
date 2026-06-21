// JSON-from-LLM helper. The AIS Agent returns free text (sometimes fenced or
// with stray prose), so we steer it to pure JSON and parse defensively.
import { getLLM, type LLMOptions } from "../llm";

export function extractJson(text: string): string {
  let t = text.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (t.startsWith("{") || t.startsWith("[")) return t;
  const starts = [t.indexOf("{"), t.indexOf("[")].filter((i) => i >= 0);
  if (!starts.length) return t;
  const start = Math.min(...starts);
  const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  return end > start ? t.slice(start, end + 1) : t;
}

export async function completeJson<T>(
  prompt: string,
  opts?: LLMOptions & { retries?: number },
): Promise<T | null> {
  const llm = getLLM();
  const system =
    (opts?.system ? `${opts.system}\n\n` : "") +
    "Respond with ONLY valid JSON — no prose, no markdown fences, and do not call any tools.";
  const tries = opts?.retries ?? 1;
  for (let i = 0; i <= tries; i++) {
    const raw = await llm.complete(prompt, { ...opts, system, json: true });
    try {
      return JSON.parse(extractJson(raw)) as T;
    } catch {
      // retry once with the same directive
    }
  }
  return null;
}
