# PulseAI

A self-improving research agent. Give it a topic; it plans sub-queries, searches the
web + communities, filters out low-quality sources, deep-reads the good ones, scores its
own research, and **loops until the research is strong enough** — then synthesizes a
thesis with cited claims and saves it to a notebook.

The model backend is **Intelligence Studio** (the deployed `AI-News-Model` agent),
called through the App Central gateway. It's swappable via one interface (`src/llm.ts`).

> **Status: Phase 1 complete** — the research loop runs end-to-end. Phases 2 (content
> generation) and 3 (daily digest email) are scaffolded in `BUILD_SPEC.md` but not built.

---

## How the loop works (BUILD_SPEC §3)

```
plan → search → input-gate → dedupe → extract → score(researchScore) → assess
     └────────────── refine queries & repeat (capped) ◀── NO ──┘
                                                          YES → synthesize → notebook
```

It **stops** when ANY is true: `researchScore ≥ TARGET` (75), or `MAX_ROUNDS` (3) reached,
or the round-over-round gain `< MIN_GAIN` (5, i.e. diminishing returns). On a NO decision
it refines queries aimed at the **weakest** scoring dimension (quality / diversity /
coverage / recency).

---

## Setup

**Prerequisites:** Node ≥ 20 (tested on 24), and — optionally — Podman for SearXNG.

```bash
npm install
cp .env.example .env     # then fill in the AIS credentials (see below)
```

`.env` (git-ignored) needs the Intelligence Studio credentials:
```
LLM_PROVIDER=ais
INTELLIGENCE_STUDIO_API_KEY="sk-..."
IAM_CLIENT_ID="...-SERVICE"
IAM_CLIENT_SECRET="..."
IAM_TOKEN_URL="https://your-ais-gateway/iam/auth/realms/ais/protocol/openid-connect/token"
AIS_RUN_URL="https://your-ais-gateway/ais/api/v1/run/<flow-id>"
```

**SearXNG (optional but recommended)** for whole-web breadth — see [searxng/SETUP.md](searxng/SETUP.md).
Without it, the run still works on the keyless adapters (Google News, HN, Dev.to, RSS).

---

## Commands

```bash
npm run test:llm                       # verify the AIS model backend responds
npm run test:search "a topic"          # verify the search + extract layer
npm run research "your topic"          # run the full Phase 1 loop (content mode)
npm run research "a market" -- --mode=market-intel   # stricter, evidence-first mode
npm run typecheck                      # tsc --noEmit
```

Add `PULSE_DEBUG=1` to see per-source result counts.

Output lands in:
- `output/notebook/<date>-<topic>.json` — the saved `ResearchResult` (your learning record)
- `output/eval-reports/<date>-<topic>.json` + `history.jsonl` — per-run scorecard + rolling history

---

## Configuration (`src/config.ts`)

| Key | Default | Meaning |
|-----|---------|---------|
| `TARGET` | 75 | researchScore that stops the loop |
| `MAX_ROUNDS` | 3 | hard cap on rounds |
| `MIN_GAIN` | 5 | plateau threshold |
| `FRESHNESS_DAYS` | 365 | non-evergreen recency window |
| `RESULTS_PER_QUERY` | 8 | per-query result target |
| `LLM_PROVIDER` | `ais` | model backend (`ais` \| `ollama`) |

---

## Architecture notes

- **One source shape** (`Article`) and **one model interface** (`LLM`) — adapters and
  providers are drop-in (`src/search/adapters/*`, providers in `src/llm.ts`).
- **Caching:** raw fetches are cached under `.cache/http` so runs are replayable.
- **The AIS flow is a tool-using Agent**, not a bare LLM, so PulseAI's reasoning prompts
  explicitly steer it to answer directly; PulseAI does its own search per the spec.

## Honest limitations (BUILD_SPEC §14)
1. SearXNG is local-only; a deployed site can't reach it.
2. Full-text extraction fails on paywalls / bot-blocks / JS-only pages → snippet fallback.
3. Reddit's keyless endpoint rate-limits; it's best-effort, never the backbone.
4. Quality gates intentionally reduce throughput — that's the point.
