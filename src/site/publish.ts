// Publish a generated blog into the static site and rebuild it. Exports only —
// no top-level side effects (so generatePro can import publishPost safely).
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { marked } from "marked";
import { parseBlog, renderIndexHtml, renderPostHtml, CSS, type PostMeta } from "./render";
import { log } from "../log";

const SITE = "site";
const DRAFTS = "output/drafts";

async function loadManifest(): Promise<PostMeta[]> {
  try {
    return JSON.parse(await readFile(join(SITE, "posts.json"), "utf8")) as PostMeta[];
  } catch {
    return [];
  }
}

async function saveManifest(posts: PostMeta[]): Promise<void> {
  await mkdir(SITE, { recursive: true });
  await writeFile(join(SITE, "posts.json"), JSON.stringify(posts, null, 2), "utf8");
}

async function copyImage(file: string): Promise<void> {
  if (!file) return;
  await mkdir(join(SITE, "assets"), { recursive: true });
  try {
    await copyFile(join(DRAFTS, file), join(SITE, "assets", basename(file)));
  } catch {
    // image missing — the post still renders without it
  }
}

/** Add/update one post in the manifest (stamping publishedAt once) and rebuild. */
export async function publishPost(base: string): Promise<void> {
  const md = await readFile(join(DRAFTS, `${base}-blog.md`), "utf8");
  const { title, image, excerpt } = parseBlog(md);

  const posts = await loadManifest();
  const existing = posts.find((p) => p.id === base);
  const publishedAt = existing?.publishedAt ?? new Date().toISOString();
  await copyImage(image);

  const meta: PostMeta = { id: base, slug: base, title, image: basename(image), excerpt, publishedAt };
  const next = existing ? posts.map((p) => (p.id === base ? meta : p)) : [...posts, meta];
  await saveManifest(next);
  await rebuildSite(next);
  log.ok(`published: "${title}"`);
}

/** Regenerate the whole site (index + every post page) from the manifest. */
export async function rebuildSite(posts?: PostMeta[]): Promise<void> {
  const all = posts ?? (await loadManifest());
  all.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)); // newest first

  await mkdir(join(SITE, "posts"), { recursive: true });
  await writeFile(join(SITE, "style.css"), CSS, "utf8");
  await writeFile(join(SITE, "index.html"), renderIndexHtml(all), "utf8");

  for (const p of all) {
    const md = await readFile(join(DRAFTS, `${p.id}-blog.md`), "utf8");
    const { body, image } = parseBlog(md);
    await copyImage(image);
    // Repoint any in-body image paths at /assets.
    const fixed = body.replace(/(!\[[^\]]*\]\()([^)]+)(\))/g, (_m, a, src, c) => `${a}../assets/${basename(src)}${c}`);
    const bodyHtml = marked.parse(fixed) as string;
    await writeFile(join(SITE, "posts", `${p.slug}.html`), renderPostHtml(p, bodyHtml), "utf8");
  }
  log.ok(`site rebuilt: ${all.length} post(s) → ${SITE}/index.html`);
}
