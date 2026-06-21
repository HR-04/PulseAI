// Shared data shapes. Every search source returns Article[]; the loop produces a
// ResearchResult. Kept identical to BUILD_SPEC.md §6 so adapters stay swappable.

export interface Article {
  title: string;
  url: string;
  source: string; // e.g. "reddit", "searxng", domain name
  publishedAt?: string; // ISO date if known
  snippet: string; // short preview, always present
  fullText?: string; // filled by extract step; may be absent on failure
  domain: string; // hostname, for the reputation gate
}

export type Mode = "content" | "market-intel";

export interface KeyClaim {
  claim: string;
  sourceUrls: string[];
}

export interface Synthesis {
  thesis: string; // the point of view
  keyClaims: KeyClaim[];
  agreements: string[];
  disagreements: string[]; // where sources conflict
  whatsNew: string[]; // novel vs recycled
}

export interface ResearchResult {
  topic: string;
  mode: Mode;
  rounds: number;
  researchScore: number;
  articles: Article[]; // surviving, extracted, ranked sources
  synthesis: Synthesis; // produced after the loop passes
  createdAt: string;
}
