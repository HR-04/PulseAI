// Central config. Loop knobs come from BUILD_SPEC.md §13; secrets/URLs come from
// the environment (.env, loaded via `node --env-file=.env`).

export const config = {
  // --- Model backend ---
  LLM_PROVIDER: process.env.LLM_PROVIDER ?? "ais",

  // --- Self-improving loop (§3) ---
  TARGET: 75, // researchScore that stops the loop
  MAX_ROUNDS: 3, // hard cap on rounds
  MIN_GAIN: 5, // plateau threshold between consecutive rounds
  FRESHNESS_DAYS: 365, // non-evergreen recency window

  // --- Search ---
  SEARXNG_URL: process.env.SEARXNG_URL ?? "http://localhost:8080",
  RESULTS_PER_QUERY: 8,

  // --- Intelligence Studio (model backend) ---
  ais: {
    tokenUrl: process.env.IAM_TOKEN_URL ?? "",
    runUrl: process.env.AIS_RUN_URL ?? "",
    apiKey: process.env.INTELLIGENCE_STUDIO_API_KEY ?? "",
    clientId: process.env.IAM_CLIENT_ID ?? "",
    clientSecret: process.env.IAM_CLIENT_SECRET ?? "",
    // Override the flow's Azure deployment per-run via tweaks (flow ships with
    // gpt-5.4-mini; we run gpt-5.4). Empty AIS_AZURE_DEPLOYMENT = use flow default.
    modelNodeId: process.env.AIS_MODEL_NODE_ID ?? "",
    azureDeployment: process.env.AIS_AZURE_DEPLOYMENT ?? "gpt-5.4",
  },

  // --- Ollama fallback (optional, local, $0) ---
  ollama: {
    url: process.env.OLLAMA_URL ?? "http://localhost:11434",
    model: process.env.OLLAMA_MODEL ?? "llama3.1:8b",
  },

  // --- LinkedIn auto-posting (official API, w_member_social) ---
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    redirectUri: process.env.LINKEDIN_REDIRECT_URI ?? "http://localhost:5555/callback",
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN ?? "",
    authorUrn: process.env.LINKEDIN_AUTHOR_URN ?? "",
  },
} as const;

export type Config = typeof config;
