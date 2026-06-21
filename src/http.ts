// Fetch helpers: timeout + a polite User-Agent + on-disk caching of raw
// responses so runs are replayable for debugging (BUILD_SPEC §10). Never throws
// — returns null on any failure so the pipeline degrades gracefully.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const UA = "Mozilla/5.0 (compatible; PulseAI/0.1; +research-agent)";
const CACHE_DIR = join(".cache", "http");

export interface FetchOpts {
  timeoutMs?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  accept?: string;
  cache?: boolean; // default: true for GET
  ttlMs?: number; // default 6h
}

function keyFor(url: string, opts: FetchOpts): string {
  return createHash("sha1")
    .update(`${opts.method ?? "GET"}:${url}:${opts.body ?? ""}`)
    .digest("hex");
}

async function readCache(key: string, ttlMs: number): Promise<string | null> {
  try {
    const raw = await readFile(join(CACHE_DIR, `${key}.json`), "utf8");
    const { ts, body } = JSON.parse(raw) as { ts: number; body: string };
    return Date.now() - ts > ttlMs ? null : body;
  } catch {
    return null;
  }
}

async function writeCache(key: string, body: string): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, `${key}.json`), JSON.stringify({ ts: Date.now(), body }));
  } catch {
    // cache is best-effort
  }
}

export async function fetchText(url: string, opts: FetchOpts = {}): Promise<string | null> {
  const method = opts.method ?? "GET";
  const useCache = opts.cache ?? method === "GET";
  const ttl = opts.ttlMs ?? 6 * 60 * 60 * 1000;
  const key = keyFor(url, opts);

  if (useCache) {
    const hit = await readCache(key, ttl);
    if (hit !== null) return hit;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15_000);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "User-Agent": UA,
        ...(opts.accept ? { Accept: opts.accept } : {}),
        ...(opts.headers ?? {}),
      },
      body: opts.body,
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (useCache) await writeCache(key, text);
    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T | null> {
  const text = await fetchText(url, { accept: "application/json", ...opts });
  if (text == null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
