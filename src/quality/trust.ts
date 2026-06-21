// Tiered domain trust, shared by the input gate (drop denied), the ranker
// (order survivors), and the scorer (sourceQuality). BUILD_SPEC §7.1.
// Lists are intentionally small and conservative — unknown domains are NOT
// rejected, just scored neutrally.
import { domainOf } from "../util";

// Tier-1: established, editorially-accountable, or primary sources → 92.
const TIER1 = new Set<string>([
  "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "nytimes.com",
  "theguardian.com", "wsj.com", "economist.com", "ft.com",
  "nature.com", "science.org", "arxiv.org", "acm.org", "ieee.org",
  "mit.edu", "stanford.edu", "berkeley.edu",
  "arstechnica.com", "theverge.com", "wired.com", "spectrum.ieee.org",
  "openai.com", "anthropic.com", "deepmind.com", "ai.googleblog.com",
  "research.google", "blog.google", "microsoft.com", "huggingface.co",
  "github.com", "github.blog", "news.ycombinator.com",
]);

// Tier-2: reputable trade/tech press and strong technical communities → 72.
const TIER2 = new Set<string>([
  "techcrunch.com", "venturebeat.com", "zdnet.com", "theregister.com",
  "infoworld.com", "engadget.com", "technologyreview.com", "semafor.com",
  "axios.com", "theinformation.com", "stackoverflow.com", "dev.to",
  "smashingmagazine.com", "infoq.com", "thenewstack.io",
]);

// Tier-3: mixed-quality but often useful (user-generated / aggregated) → 58.
const TIER3 = new Set<string>([
  "medium.com", "substack.com", "reddit.com", "quora.com",
  "hackernoon.com", "dzone.com",
]);

// Deny: content farms / SEO-spam patterns → rejected outright.
const DENY = new Set<string>([
  "ehow.com", "answers.com", "wikihow-spam.com",
]);
const DENY_PATTERNS = [/(^|\.)blogspot\./, /\bfreearticles?\b/, /-{3,}/];

export function isDenied(domain: string): boolean {
  if (!domain) return true; // unparseable URL
  if (DENY.has(domain)) return true;
  return DENY_PATTERNS.some((re) => re.test(domain));
}

/** 0–100 trust for a domain (or a full URL). */
export function domainTrust(domainOrUrl: string): number {
  const d = domainOrUrl.includes("/") ? domainOf(domainOrUrl) : domainOrUrl.toLowerCase();
  if (isDenied(d)) return 0;
  if (TIER1.has(d)) return 92;
  if (TIER2.has(d)) return 72;
  if (TIER3.has(d)) return 58;
  // Heuristic nudges for unknown domains.
  if (d.endsWith(".edu") || d.endsWith(".gov")) return 85;
  if (d.endsWith(".org")) return 60;
  return 50; // neutral unknown
}

export const TrustTiers = { TIER1, TIER2, TIER3 };
