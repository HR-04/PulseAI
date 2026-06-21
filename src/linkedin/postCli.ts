// CLI: post a LinkedIn .txt (e.g. a generated post) to LinkedIn.
//   npm run linkedin:post -- "output/drafts/<base>-linkedin.txt"
import { readFile } from "node:fs/promises";
import { postToLinkedIn } from "./post";

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) {
  console.error('Usage: npm run linkedin:post -- "output/drafts/<base>-linkedin.txt"');
  process.exit(1);
}

const text = (await readFile(file, "utf8")).trim();
if (!text) {
  console.error("File is empty.");
  process.exit(1);
}

try {
  const id = await postToLinkedIn(text);
  console.log(`✅ posted to LinkedIn: ${id}`);
} catch (e) {
  console.error("❌ " + (e as Error).message);
  process.exit(1);
}
