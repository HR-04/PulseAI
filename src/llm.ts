// Model-agnostic LLM interface (BUILD_SPEC.md §8). EVERY model call in the project
// goes through this. Swap providers via LLM_PROVIDER in .env — no vendor calls
// scattered elsewhere.

import { config } from "./config";

export interface LLMOptions {
  json?: boolean; // hint that we expect JSON back
  system?: string; // optional system / instruction message
}

export interface LLM {
  readonly name: string;
  complete(prompt: string, opts?: LLMOptions): Promise<string>;
}

// ───────────────────────────────────────────────────────────────────────────
// Intelligence Studio (AIS) — App Central gateway.
// Auth = IAM client_credentials JWT (Bearer) + Intelligence Studio x-api-key.
// The deployed flow is wired ChatInput → Agent → ChatOutput, so a plain
// payload routes correctly. The Agent (gpt-5.4-mini) may also call its Web
// Search / Image Generator tools — PulseAI's prompts steer it to answer
// directly for the loop's reasoning calls.
// ───────────────────────────────────────────────────────────────────────────
class AISProvider implements LLM {
  readonly name = "ais";
  private token: string | null = null;
  private tokenExpiresAtMs = 0;

  private async getToken(): Promise<string> {
    const { tokenUrl, clientId, clientSecret } = config.ais;
    if (!tokenUrl || !clientId || !clientSecret) {
      throw new Error(
        "AIS not configured: set IAM_TOKEN_URL, IAM_CLIENT_ID, " +
          "IAM_CLIENT_SECRET (and AIS_RUN_URL) in .env",
      );
    }
    // Reuse the token until ~60s before expiry.
    if (this.token && Date.now() < this.tokenExpiresAtMs - 60_000) {
      return this.token;
    }
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) {
      throw new Error(`IAM token request failed: ${res.status} ${res.statusText}`);
    }
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) throw new Error("IAM token response missing access_token");
    this.token = j.access_token;
    this.tokenExpiresAtMs = Date.now() + (j.expires_in ?? 1800) * 1000;
    return this.token;
  }

  async complete(prompt: string, opts?: LLMOptions): Promise<string> {
    const { runUrl, apiKey, modelNodeId, azureDeployment } = config.ais;
    if (!runUrl) throw new Error("AIS not configured: set AIS_RUN_URL in .env");
    const token = await this.getToken();

    // The Agent's own system prompt is fixed in the flow, so any per-call
    // instruction is folded into the input text.
    const input = opts?.system ? `${opts.system}\n\n${prompt}` : prompt;
    const payload: Record<string, unknown> = {
      output_type: "text",
      input_type: "text",
      input_value: input,
      session_id: `pulseai_${Date.now()}`,
    };
    // Override the model node's Azure deployment per-run (e.g. gpt-5.4) without
    // re-importing the flow. Input still routes through ChatInput.
    if (azureDeployment && modelNodeId) {
      payload.tweaks = { [modelNodeId]: { azure_deployment: azureDeployment } };
    }

    const res = await fetch(runUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`AIS run failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();
    const text = extractAISText(data);
    if (!text) {
      throw new Error(
        "AIS run returned HTTP 200 but no text could be extracted. Check the " +
          "flow's ChatOutput wiring, or the response shape in extractAISText().",
      );
    }
    return text;
  }
}

// Walk the Langflow/AIS run response for the first non-empty text payload.
// Known shapes put it under outputs[0].outputs[0].results.{message|output_value|messages}.
function extractAISText(data: unknown): string {
  const root = data as { outputs?: Array<{ outputs?: unknown[] }> };
  const inner = root?.outputs?.[0]?.outputs;
  if (Array.isArray(inner)) {
    for (const o of inner) {
      const node = o as {
        results?: {
          output_value?: unknown;
          message?: { text?: unknown; data?: { text?: unknown } } | string;
          messages?: Array<{ text?: unknown; message?: unknown }>;
        };
        outputs?: { message?: { message?: unknown }; text?: { text?: unknown } };
      };
      const r = node.results ?? {};
      const candidates: unknown[] = [
        typeof r.message === "string" ? r.message : r.message?.text,
        typeof r.message === "object" ? r.message?.data?.text : undefined,
        r.output_value,
        Array.isArray(r.messages)
          ? r.messages.map((m) => m?.text ?? m?.message).filter(Boolean).join("\n")
          : undefined,
        node.outputs?.message?.message,
        node.outputs?.text?.text,
      ];
      for (const c of candidates) {
        if (typeof c === "string" && c.trim()) return c.trim();
      }
    }
  }
  return deepFindText(data) ?? "";
}

// Last-ditch: longest string under a text-ish key anywhere in the object.
function deepFindText(obj: unknown, depth = 0): string | undefined {
  if (depth > 8 || obj == null) return undefined;
  let best: string | undefined;
  const consider = (s: unknown) => {
    if (typeof s === "string" && s.trim() && (!best || s.length > best.length)) best = s.trim();
  };
  if (Array.isArray(obj)) {
    for (const v of obj) consider(deepFindText(v, depth + 1));
  } else if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (/^(text|message|output_value|response|content)$/i.test(k)) consider(v);
      consider(deepFindText(v, depth + 1));
    }
  }
  return best;
}

// ───────────────────────────────────────────────────────────────────────────
// Ollama — local, $0, no key. Useful fallback for offline / rate-limit-free runs.
// ───────────────────────────────────────────────────────────────────────────
class OllamaProvider implements LLM {
  readonly name = "ollama";
  async complete(prompt: string, opts?: LLMOptions): Promise<string> {
    const res = await fetch(`${config.ollama.url}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollama.model,
        prompt: opts?.system ? `${opts.system}\n\n${prompt}` : prompt,
        stream: false,
        ...(opts?.json ? { format: "json" } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
    const j = (await res.json()) as { response?: string };
    return (j.response ?? "").trim();
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Factory — the one place providers are selected.
// ───────────────────────────────────────────────────────────────────────────
let cached: LLM | null = null;

export function getLLM(): LLM {
  if (cached) return cached;
  switch (config.LLM_PROVIDER) {
    case "ollama":
      cached = new OllamaProvider();
      break;
    case "ais":
    default:
      cached = new AISProvider();
      break;
  }
  return cached;
}

// Exposed for unit-style checks.
export const _internal = { extractAISText };
