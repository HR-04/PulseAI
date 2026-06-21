# PulseAI

A self-improving research agent. Give it a topic; it researches the web + communities,
scores its own sources, and **loops until the research clears a quality bar** — then writes
a verified blog post, a LinkedIn post, and an illustration, publishes them to a Medium-style
site (**LOOP**), and can post to LinkedIn.

Model backend: **Intelligence Studio** (`AI-News-Model` agent) behind one swappable
interface (`src/llm.ts`); Ollama fallback included.

## Pipeline

```
topic → plan → search → quality-gate → extract → score → refine&loop
      → synthesize → blog.md + linkedin.txt + image → publish (site) → post (LinkedIn)
```

The loop **stops** when the research score ≥ `TARGET` (75), `MAX_ROUNDS` (3) is hit, or the
gain plateaus (`< MIN_GAIN`). On a "keep going", it refines toward the weakest dimension
(source quality / diversity / coverage / recency). Knobs live in `src/config.ts`.

## Setup

```bash
npm install
cp .env.example .env      # fill in Intelligence Studio + LinkedIn credentials
```

- **SearXNG** (optional, whole-web search) — see [searxng/SETUP.md](searxng/SETUP.md). Without it,
  keyless adapters (Google News, HN, Dev.to, RSS) carry the run.
- **LinkedIn** (optional, auto-posting) — run `npm run linkedin:auth` once.

## Commands

| Command | Does |
|---|---|
| `npm run research "topic"` | research → scored, synthesized notebook entry (`output/notebook/`) |
| `npm run generate:pro -- --intent="…" <notebook.json>` | blog + LinkedIn + image (best-of-N, claim-verified); auto-publishes to the site |
| `npm run serve` | serve the LOOP blog at `localhost:4000` |
| `npm run publish -- <blog-base>` | (re)publish a post into the site |
| `npm run linkedin:auth` | one-time LinkedIn OAuth (saves token to `.env`) |
| `npm run linkedin:post -- "<file.txt>"` | post a generated `.txt` to LinkedIn |
| `npm run test:llm` · `test:search` · `typecheck` | connectivity + type checks |

Add `--mode=market-intel` to `research` for a stricter, evidence-first brief. `PULSE_DEBUG=1` shows per-source counts.

## Stack

TypeScript / Node (ESM, `tsx`). One `Article` shape + one `LLM` interface → drop-in search
adapters and model providers. Fetches cached under `.cache/`. The blog renders to a static
Medium-style site in `site/`, deployable to Vercel (`vercel.json`).

## Status

| Phase | |
|---|---|
| Research loop | ✅ |
| Content generation (blog + LinkedIn + image, with claim-to-source gate) | ✅ |
| Website (LOOP, Medium-style) + LinkedIn auto-posting | ✅ |
| Scheduled daily AI-news digest email | ⬜ not built |

## Honest limits

- SearXNG is local-only (a deployed site can't reach it); keyless adapters still work.
- Full-text extraction falls back to snippets on paywalls / JS-only pages.
- The image model produces illustrations, not precise diagrams (embedded text can garble).
- LinkedIn access tokens expire ~60 days → re-run `npm run linkedin:auth`.
