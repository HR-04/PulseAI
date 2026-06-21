// IMAGE — produced SOLELY by PulseAI's image model (the AIS flow's Image
// Generator tool), then retrieved locally. No Claude-Code drawing/SVG.
//
// Honest note: this is a diffusion-style image model. It makes detailed
// conceptual illustrations, not crisp labeled diagrams — embedded text may be
// imperfect. That is inherent to the model, by the user's explicit choice to
// have the image come purely from PulseAI.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { getLLM } from "./llm";
import { config } from "./config";
import { log } from "./log";

/** Ask PulseAI's AIS agent to generate an image via its Image Generator tool. */
export async function generateIllustration(topic: string): Promise<string | null> {
  const prompt =
    `Use the generate_image tool to create a DETAILED, professional, modern digital ` +
    `illustration representing the concept: "${topic}". Rich visual detail, clean ` +
    `composition, cohesive color palette, minimal text. After generating, reply with ` +
    `ONLY the resulting image URL.`;
  try {
    const out = await getLLM().complete(prompt);
    const m = out.match(/https?:\/\/\S+/);
    const url = m ? m[0].replace(/[)\]>.,]+$/, "") : null;
    if (url) log.ok(`image model returned a URL: ${url.slice(0, 70)}…`);
    else log.warn("image model returned no URL (shipping without image)");
    return url;
  } catch (e) {
    log.warn(`image step failed: ${(e as Error).message}`);
    return null;
  }
}

/** Retrieve the AIS-gated image (IAM token + x-api-key) and save it locally. */
export async function downloadAISImage(url: string, outPath: string): Promise<string | null> {
  try {
    const t = await fetch(config.ais.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.ais.clientId,
        client_secret: config.ais.clientSecret,
      }),
    });
    if (!t.ok) return null;
    const token = ((await t.json()) as { access_token?: string }).access_token;
    if (!token) return null;

    const res = await fetch(url, {
      headers: { "x-api-key": config.ais.apiKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      log.warn(`image download HTTP ${res.status}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const sig = buf.subarray(0, 4).toString("hex");
    const isImg = sig.startsWith("89504e47") || sig.startsWith("ffd8") || sig.startsWith("52494646");
    if (!isImg) {
      log.warn("downloaded bytes are not a PNG/JPEG/WEBP image");
      return null;
    }
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, buf);
    log.ok(`image saved: ${outPath} (${buf.length} bytes)`);
    return outPath;
  } catch (e) {
    log.warn(`image download failed: ${(e as Error).message}`);
    return null;
  }
}
