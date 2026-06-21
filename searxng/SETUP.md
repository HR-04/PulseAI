# SearXNG setup (whole-web search, $0, no key)

PulseAI's `src/search/searxng.ts` calls `GET ${SEARXNG_URL}/search?q=<query>&format=json`.
SearXNG runs locally via Podman. **If it isn't running, PulseAI still works** — that
source just returns `[]` and the keyless adapters (Google News, HN, Dev.to, RSS) carry the run.

> Local-only limitation: a deployed website cannot reach `localhost:8080`. Fine for the
> local agent; for a hosted deployment, swap in a hosted search (BUILD_SPEC §14.1).

## One-time setup (Podman)

```bash
# 1. Pull the image
podman pull docker.io/searxng/searxng

# 2. First run — generates config into ./searxng-config on the host
podman run -d --name searxng -p 8080:8080 \
  -v "${PWD}/searxng-config:/etc/searxng:rw" \
  docker.io/searxng/searxng
```

PowerShell: use `-v "${PWD}\searxng-config:/etc/searxng:rw"`.

```yaml
# 3. Edit ./searxng-config/settings.yml:
#    a) enable JSON output (the agent needs it):
search:
  formats:
    - html
    - json
#    b) allow programmatic access (avoid 429s on the JSON API):
server:
  limiter: false
  public_instance: false
```

```bash
# 4. Restart to apply
podman restart searxng

# 5. Verify it returns JSON
curl "http://localhost:8080/search?q=test&format=json"
```

## Day-to-day

```bash
podman start searxng     # bring it up
podman stop searxng      # take it down
podman logs searxng      # troubleshoot
podman rm -f searxng     # remove entirely
```

## Notes
- SearXNG proxies upstream engines (Google, Bing, DuckDuckGo, …) which can rate-limit
  under heavy use; personal/research volume is fine (BUILD_SPEC §14.3).
- `SEARXNG_URL` is set in `.env` (defaults to `http://localhost:8080`).
