// Phase 2 orchestrator — outputs authored SOLELY by PulseAI (AIS):
//   blog (.md) + LinkedIn (.txt) text by the gpt-5.4 agent; image (.png) by the
//   AIS Image Generator model. Claude Code only orchestrates + packages; it does
//   NOT write or alter any content/image.
// Run: npm run generate:pro -- --intent="..." ["output/notebook/<file>.json"]
import { readFile, readdir, writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ResearchResult } from "./types";
import { getLLM } from "./llm";
import { refineBlog } from "./agent/refineContent";
import { generateIllustration, downloadAISImage } from "./image";
import { publishPost } from "./site/publish";
import { slugify, writeJson } from "./util";
import { log } from "./log";

function flag(name: string): string | undefined {
  const a = process.argv.slice(2).find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : undefined;
}

async function resolveNotebook(): Promise<string> {
  const positional = process.argv.slice(2).find((x) => !x.startsWith("--"));
  if (positional) return positional;
  const dir = "output/notebook";
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  let best: string | null = null;
  let bestM = -1;
  for (const f of files) {
    const s = await stat(join(dir, f));
    if (s.mtimeMs > bestM) {
      bestM = s.mtimeMs;
      best = f;
    }
  }
  if (!best) {
    console.error('No notebook entries. Run `npm run research "topic"` first.');
    process.exit(1);
  }
  return join(dir, best);
}

// LinkedIn copy — plain text (it goes to a .txt for direct pasting).
async function linkedinPost(topic: string, thesis: string, blogFile: string): Promise<string> {
  const out = await getLLM().complete(
    `Write a LinkedIn post (≤1200 chars) about "${topic}".\nThesis: ${thesis}\n\n` +
      `Plain text only — NO markdown, no asterisks, no headings. Strong first-line hook, ` +
      `3–4 short takeaway lines, a line pointing readers to the full blog (${blogFile}), and ` +
      `3–5 hashtags at the end. No invented facts. Do not call any tools.`,
    { system: "You are a sharp LinkedIn writer. Output plain text ready to paste into LinkedIn." },
  );
  return out.trim();
}

async function main(): Promise<void> {
  const path = await resolveNotebook();
  const r = JSON.parse(await readFile(path, "utf8")) as ResearchResult;
  const intent = flag("intent") ?? r.topic;
  log.step(`generate:pro — intent "${intent}" (from ${path})`);

  // 1) Blog text — PulseAI AIS LLM, self-refined (best-of-N to beat variance).
  const attempts = Number(flag("attempts") ?? "3");
  const maxRounds = Number(flag("rounds") ?? "2");
  let refined = await refineBlog(r, intent, { target: 92, maxRounds });
  for (let i = 2; i <= attempts; i++) {
    log.step(`best-of-${attempts}: attempt ${i} (best so far ${refined.score.overall})`);
    const cand = await refineBlog(r, intent, { target: 92, maxRounds });
    if (cand.score.overall > refined.score.overall) refined = cand;
  }
  log.ok(
    `best-of-${attempts} content ${refined.score.overall}/100 ` +
      `(onTopic ${refined.score.onTopic}, value ${refined.score.value}, grounding ${refined.score.grounding}, ` +
      `structure ${refined.score.structure}, voice ${refined.score.voice})`,
  );

  const base = `${r.createdAt.slice(0, 10)}-${slugify(r.topic)}-v3`;

  // 2) Image — SOLELY PulseAI's image model, then retrieved locally.
  const imgUrl = await generateIllustration(r.topic);
  let imgRef = "";
  let imgPath: string | null = null;
  if (imgUrl) {
    imgPath = await downloadAISImage(imgUrl, `output/drafts/${base}-image.png`);
    if (imgPath) imgRef = `![${r.topic}](${base}-image.png)\n\n`;
  }

  // 3) Assemble (package only — PulseAI's text is used verbatim, unaltered).
  await mkdir("output/drafts", { recursive: true });
  const sources = r.articles.map((a, i) => `- [S${i + 1}] [${a.title}](${a.url})`).join("\n");
  const blogFile = `output/drafts/${base}-blog.md`;
  const blog =
    `${imgRef}${refined.draft}\n\n---\n\n## Sources\n${sources}\n\n---\n\n` +
    `*Generated solely by PulseAI (Intelligence Studio): text by the gpt-5.4 agent, ` +
    `image by its Image Generator model. Content self-refined to ${refined.score.overall}/100 ` +
    `(onTopic ${refined.score.onTopic}). Source research scored ${r.researchScore}.*\n`;
  await writeFile(blogFile, blog, "utf8");

  const li = await linkedinPost(r.topic, r.synthesis.thesis, blogFile);
  const liFile = `output/drafts/${base}-linkedin.txt`;
  await writeFile(liFile, li + "\n", "utf8");

  await writeJson(`output/drafts/${base}-report.json`, {
    intent,
    sourceNotebook: path,
    content: refined.score,
    overallHistory: refined.history.map((h) => h.overall),
    rounds: refined.rounds,
    image: { url: imgUrl, localPath: imgPath },
    files: { blogFile, liFile, imagePath: imgPath },
  });

  // 4) auto-publish to the Medium-style site
  try {
    await publishPost(base);
  } catch (e) {
    log.warn(`auto-publish skipped: ${(e as Error).message}`);
  }

  log.ok(`blog → ${blogFile}`);
  log.ok(`linkedin → ${liFile}`);
  log.ok(`image → ${imgPath ?? "NONE (model returned no usable image)"}`);
  log.ok("DONE");
}

main().catch((e) => {
  log.error((e as Error).message);
  process.exit(1);
});
