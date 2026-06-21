// Minimal RSS/Atom item extraction shared by the googleNews + genericRss adapters.
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export interface RssItem {
  title: string;
  link: string;
  description?: string;
  pubDate?: string;
  sourceUrl?: string; // Google News exposes the real publisher in <source url="...">
}

export function stripHtml(s?: string): string {
  if (s == null) return "";
  return String(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return stripHtml((v as Record<string, string>)["#text"]);
  return stripHtml(String(v));
}

function linkOf(it: Record<string, unknown>): string {
  const l = it.link;
  if (typeof l === "string") return l;
  if (Array.isArray(l)) {
    const withHref = l.find((x) => x && typeof x === "object" && "@_href" in x) as
      | Record<string, string>
      | undefined;
    return withHref?.["@_href"] ?? "";
  }
  if (l && typeof l === "object") {
    const o = l as Record<string, string>;
    return o["@_href"] ?? o["#text"] ?? "";
  }
  return "";
}

export function parseRss(xml: string): RssItem[] {
  let doc: Record<string, any>;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  const raw = doc?.rss?.channel?.item ?? doc?.feed?.entry ?? [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items
    .map((it: Record<string, unknown>) => {
      const src = it.source as Record<string, string> | undefined;
      return {
        title: asText(it.title),
        link: linkOf(it),
        description: asText(it.description ?? it.summary ?? it.content),
        pubDate: (it.pubDate ?? it.published ?? it.updated) as string | undefined,
        sourceUrl: src && typeof src === "object" ? src["@_url"] : undefined,
      };
    })
    .filter((i: RssItem) => i.link && i.title);
}
