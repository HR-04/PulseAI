// CLI: publish one or more blog bases into the site, or just rebuild.
//   npm run publish -- <base> [<base> ...]
//   npm run publish -- --rebuild
import { publishPost, rebuildSite } from "./publish";
import { log } from "../log";

const args = process.argv.slice(2);

async function main(): Promise<void> {
  if (!args.length || args[0] === "--rebuild") {
    await rebuildSite();
    return;
  }
  for (const base of args.filter((a) => !a.startsWith("--"))) {
    // accept either a bare base or a path like output/drafts/<base>-blog.md
    const b = base.replace(/^.*[/\\]/, "").replace(/-blog\.md$/, "");
    await publishPost(b);
  }
}

main().catch((e) => {
  log.error((e as Error).message);
  process.exit(1);
});
