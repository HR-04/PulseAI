// Medium-style rendering for the blog site: parse a generated blog .md, and
// render the home feed + individual post pages. Pure functions (no I/O).

export interface PostMeta {
  id: string; // the blog base name
  slug: string; // = id (filesystem-safe)
  title: string;
  image: string; // image filename in /assets (or "")
  excerpt: string;
  publishedAt: string; // ISO
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function stripMd(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull title, hero image, body, and an excerpt out of a generated blog .md. */
export function parseBlog(md: string): { title: string; image: string; body: string; excerpt: string } {
  const imgMatch = md.match(/!\[[^\]]*\]\(([^)]+)\)/);
  const image = imgMatch?.[1]?.trim() ?? "";
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? "Untitled";

  // body = everything after the title line (the hero image sits before it, so it's excluded)
  let body = titleMatch ? md.slice((titleMatch.index ?? 0) + titleMatch[0].length) : md;
  body = body.trim();

  const firstPara =
    body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith("#") && !p.startsWith("![") && !p.startsWith("---") && !p.startsWith("|")) ??
    "";
  const excerpt = stripMd(firstPara).slice(0, 220);
  return { title, image, body, excerpt };
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

export const CSS = `
:root{--ink:#242424;--muted:#6b6b6b;--line:#e6e6e6;--accent:#1a8917;--bg:#fff}
*{box-sizing:border-box}
body{margin:0;color:var(--ink);background:var(--bg);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
.site-head{display:flex;align-items:center;gap:14px;max-width:1100px;margin:0 auto;
  padding:20px 24px;border-bottom:1px solid var(--line)}
.brand{font-weight:800;font-size:22px;letter-spacing:-.3px;display:inline-flex;align-items:center}
.brand .logo{height:26px;width:auto;display:block}
.brand .dot{color:var(--accent)}
.site-head .tag{color:var(--muted);font-size:13px}

/* ---------- home feed ---------- */
.feed{max-width:760px;margin:0 auto;padding:40px 24px 80px}
.feed-title{font-size:15px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);
  font-weight:700;margin:0 0 22px;border-bottom:1px solid var(--line);padding-bottom:14px}
.card{display:flex;gap:22px;align-items:flex-start;padding:24px 0;border-bottom:1px solid var(--line);
  transition:opacity .15s}
.card:hover{opacity:.72}
.thumb{width:128px;height:96px;object-fit:cover;border-radius:8px;flex:0 0 auto;background:#f2f2f2}
.thumb.ph{background:linear-gradient(135deg,#eef2ff,#ecfeff)}
.card-body{flex:1;min-width:0}
.card-title{font-size:22px;font-weight:800;line-height:1.25;margin:0 0 8px;letter-spacing:-.3px}
.card-meta{color:var(--muted);font-size:13px;margin-bottom:10px}
.card-excerpt{color:#41413f;font-size:16px;line-height:1.5;margin:0}
.read{display:inline-block;margin-top:10px;color:var(--accent);font-weight:600;font-size:14px}

/* ---------- article ---------- */
.post{max-width:680px;margin:0 auto;padding:16px 24px 96px}
.back{display:inline-block;margin:18px 0 8px;color:var(--muted);font-size:14px}
.back:hover{color:var(--ink)}
.post-title{font-size:42px;line-height:1.15;font-weight:800;letter-spacing:-.5px;margin:18px 0 16px}
.post-meta{color:var(--muted);font-size:15px;margin-bottom:28px}
.hero{width:100%;border-radius:12px;margin:6px 0 36px;border:1px solid var(--line)}
.post-body{font-family:Georgia,"Times New Roman",serif;font-size:20px;line-height:1.8;color:#242424}
.post-body h2{font-family:-apple-system,"Segoe UI",sans-serif;font-size:30px;font-weight:800;
  letter-spacing:-.3px;margin:46px 0 14px}
.post-body h3{font-family:-apple-system,"Segoe UI",sans-serif;font-size:23px;font-weight:700;margin:34px 0 10px}
.post-body p{margin:0 0 24px}
.post-body ul,.post-body ol{margin:0 0 24px;padding-left:26px}
.post-body li{margin:8px 0}
.post-body a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}
.post-body blockquote{margin:28px 0;padding:4px 0 4px 22px;border-left:3px solid var(--ink);
  color:#41413f;font-style:italic}
.post-body code{font-family:"SF Mono",Menlo,Consolas,monospace;font-size:15px;
  background:#f2f2f2;padding:2px 6px;border-radius:4px}
.post-body pre{background:#f7f7f6;border:1px solid var(--line);border-radius:10px;padding:18px 20px;
  overflow-x:auto;margin:0 0 26px}
.post-body pre code{background:none;padding:0;font-size:14px;line-height:1.55}
.post-body img{max-width:100%;border-radius:10px;border:1px solid var(--line)}
.post-body table{border-collapse:collapse;width:100%;font-family:-apple-system,sans-serif;
  font-size:15px;margin:0 0 26px;display:block;overflow-x:auto}
.post-body th,.post-body td{border:1px solid var(--line);padding:8px 12px;text-align:left}
.post-body hr{border:none;border-top:1px solid var(--line);margin:34px 0}

@media(max-width:600px){
  .thumb{width:84px;height:64px}
  .card-title{font-size:18px}
  .post-title{font-size:30px}
  .post-body{font-size:18px}
}
`;

// LOOP wordmark — the two O's form an infinity loop (recreated as inline SVG).
const LOGO =
  `<svg class="logo" viewBox="0 0 112 40" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="LOOP">` +
  `<text x="0" y="32" font-family="-apple-system,Segoe UI,Arial,sans-serif" font-size="40" font-weight="800" letter-spacing="-2" fill="#0f172a">L</text>` +
  `<path d="M51,20 C51,6 30,6 30,20 C30,34 51,34 51,20 C51,6 72,6 72,20 C72,34 51,34 51,20 Z" fill="none" stroke="#0f172a" stroke-width="7" stroke-linecap="round"/>` +
  `<text x="79" y="32" font-family="-apple-system,Segoe UI,Arial,sans-serif" font-size="40" font-weight="800" letter-spacing="-2" fill="#0f172a">P</text>` +
  `</svg>`;

function card(p: PostMeta): string {
  const thumb = p.image
    ? `<img class="thumb" src="assets/${esc(p.image)}" alt="">`
    : `<div class="thumb ph"></div>`;
  return `<a class="card" href="posts/${esc(p.slug)}.html">
    ${thumb}
    <div class="card-body">
      <h2 class="card-title">${esc(p.title)}</h2>
      <div class="card-meta">🗓 ${esc(formatDate(p.publishedAt))}</div>
      <p class="card-excerpt">${esc(p.excerpt)}…</p>
      <span class="read">Read the full post →</span>
    </div>
  </a>`;
}

export function renderIndexHtml(posts: PostMeta[]): string {
  const cards = posts.length
    ? posts.map(card).join("\n")
    : `<p style="color:#6b6b6b">No posts yet. Run <code>npm run generate:pro</code>.</p>`;
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PulseAI — Blog</title><link rel="stylesheet" href="style.css">
</head><body>
<header class="site-head"><a class="brand" href="index.html">${LOGO}</a>
<span class="tag">Researched, written &amp; illustrated by PulseAI</span></header>
<main class="feed"><h1 class="feed-title">Latest posts</h1>
${cards}
</main></body></html>`;
}

export function renderPostHtml(p: PostMeta, bodyHtml: string): string {
  const hero = p.image ? `<img class="hero" src="../assets/${esc(p.image)}" alt="${esc(p.title)}">` : "";
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)} — PulseAI</title><link rel="stylesheet" href="../style.css">
</head><body>
<header class="site-head"><a class="brand" href="../index.html">${LOGO}</a></header>
<article class="post">
  <a class="back" href="../index.html">← All posts</a>
  <h1 class="post-title">${esc(p.title)}</h1>
  <div class="post-meta">Posted ${esc(formatDate(p.publishedAt))}</div>
  ${hero}
  <div class="post-body">${bodyHtml}</div>
</article></body></html>`;
}
