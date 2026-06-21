// Flowchart generator. The AIS model supplies the LABELS (the substance), and a
// deterministic layout renders them to a clean, legible SVG. Diffusion image-gen
// can't make legible flowcharts, and model-authored SVG geometry is unreliable —
// so we split: model = content, code = precise layout.
import { completeJson } from "./llmJson";
import type { Synthesis } from "../types";

export interface FlowStage {
  title: string;
  sub: string;
}
export interface FlowSpec {
  title: string;
  stages: FlowStage[]; // exactly 5: goal, act, measure, assess, exit
  stops: string[]; // exactly 3
  feedback: string;
}

const FALLBACK: FlowSpec = {
  title: "Anatomy of a Good Loop",
  stages: [
    { title: "1 · Goal + target", sub: "a concrete bar to hit" },
    { title: "2 · Act", sub: "do the work this round" },
    { title: "3 · Measure", sub: "score on one metric" },
    { title: "4 · Assess", sub: "stop?" },
    { title: "5 · Exit & commit", sub: "ship the result" },
  ],
  stops: ["target reached", "max iterations hit", "plateau (gain too small)"],
  feedback: "refine the weakest part",
};

export async function planFlowchart(searchIntent: string, _synthesis: Synthesis): Promise<FlowSpec> {
  const prompt =
    `Write the LABELS for a flowchart answering: "${searchIntent}".\n` +
    `It shows the anatomy of a GOOD loop in exactly 5 ordered stages: (1) goal/target, ` +
    `(2) act, (3) measure, (4) assess/decision, (5) exit/commit — plus 3 stop conditions and ` +
    `the feedback (NO-path) label.\n` +
    `Labels MUST be tiny to fit in boxes: stage title ≤ 4 words, sub ≤ 6 words, each stop ≤ 5 words, feedback ≤ 5 words.\n` +
    `Return JSON: {"title":"≤6 words","stages":[{"title":"","sub":""}],"stops":["","",""],"feedback":""} with exactly 5 stages.`;
  const r = await completeJson<FlowSpec>(prompt, {
    system: "You write ultra-concise flowchart labels. Brevity is mandatory.",
  });
  return sanitize(r);
}

function sanitize(r: FlowSpec | null): FlowSpec {
  if (!r || !Array.isArray(r.stages) || r.stages.length < 5) return FALLBACK;
  const stages = r.stages.slice(0, 5).map((s, i) => {
    const fb = FALLBACK.stages[i] as FlowStage;
    return { title: String(s?.title || fb.title).slice(0, 26), sub: String(s?.sub || fb.sub).slice(0, 42) };
  });
  const stops = (Array.isArray(r.stops) ? r.stops : []).slice(0, 3).map((s) => String(s).slice(0, 34));
  while (stops.length < 3) stops.push(FALLBACK.stops[stops.length] as string);
  // Strip a leading "no" so the rendered "NO · <feedback>" label isn't doubled.
  const feedback = String(r.feedback || FALLBACK.feedback)
    .replace(/^\s*no[\s:·.,\-]+/i, "")
    .slice(0, 34);
  return {
    title: String(r.title || FALLBACK.title).slice(0, 46),
    stages,
    stops,
    feedback: feedback || FALLBACK.feedback,
  };
}

const esc = (t: string): string => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderLoopSVG(s: FlowSpec): string {
  const [g, a, m, as, ex] = s.stages as [FlowStage, FlowStage, FlowStage, FlowStage, FlowStage];
  const box = (y: number, fill: string, stroke: string, st: FlowStage): string =>
    `<rect x="270" y="${y}" width="220" height="58" rx="11" fill="${fill}" stroke="${stroke}" stroke-width="1.7"/>` +
    `<text x="380" y="${y + 25}" text-anchor="middle" class="lbl">${esc(st.title)}</text>` +
    `<text x="380" y="${y + 43}" text-anchor="middle" class="sub">${esc(st.sub)}</text>`;

  return `<svg viewBox="0 0 780 620" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">
  <defs>
    <marker id="ar" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 Z" fill="#475569"/></marker>
    <marker id="arA" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 Z" fill="#d97706"/></marker>
    <style>
      .lbl{font-size:14px;fill:#0f172a;font-weight:600}
      .sub{font-size:11px;fill:#475569}
      .edge{stroke:#475569;stroke-width:1.7;fill:none;marker-end:url(#ar)}
      .loop{stroke:#d97706;stroke-width:2;fill:none;stroke-dasharray:6 4;marker-end:url(#arA)}
      .tag{font-size:11px;font-weight:700;letter-spacing:.4px}
    </style>
  </defs>
  <rect x="0" y="0" width="780" height="620" fill="#ffffff"/>
  <text x="390" y="32" text-anchor="middle" font-size="20" font-weight="800" fill="#0f172a">${esc(s.title)}</text>
  <text x="390" y="52" text-anchor="middle" class="sub">act → measure → assess → refine, with a defined way out</text>
  ${box(74, "#eef2ff", "#6366f1", g)}
  ${box(166, "#ecfeff", "#0891b2", a)}
  ${box(258, "#faf5ff", "#9333ea", m)}
  <polygon points="380,338 500,398 380,458 260,398" fill="#fff7ed" stroke="#d97706" stroke-width="1.8"/>
  <text x="380" y="393" text-anchor="middle" class="lbl">${esc(as.title)}</text>
  <text x="380" y="411" text-anchor="middle" class="sub">${esc(as.sub)}</text>
  ${box(494, "#f0fdf4", "#16a34a", ex)}
  <path class="edge" d="M380,132 L380,166"/>
  <path class="edge" d="M380,224 L380,258"/>
  <path class="edge" d="M380,316 L380,338"/>
  <path class="edge" d="M380,458 L380,494"/>
  <text x="398" y="482" class="tag" fill="#16a34a">YES</text>
  <path class="loop" d="M260,398 C150,398 150,195 270,195"/>
  <text x="118" y="300" class="tag" fill="#d97706" text-anchor="middle" transform="rotate(-90 118 300)">NO · ${esc(s.feedback)}</text>
  <rect x="530" y="344" width="234" height="110" rx="10" fill="#fef2f2" stroke="#dc2626" stroke-width="1.5"/>
  <text x="544" y="367" class="tag" fill="#dc2626">STOP WHEN ANY:</text>
  <text x="544" y="389" class="sub">• ${esc(s.stops[0] as string)}</text>
  <text x="544" y="411" class="sub">• ${esc(s.stops[1] as string)}</text>
  <text x="544" y="433" class="sub">• ${esc(s.stops[2] as string)}</text>
  <path class="edge" d="M500,398 L530,399" stroke-dasharray="3 3"/>
  <text x="390" y="600" text-anchor="middle" class="sub">The dashed path makes it a loop. The red box makes it safe.</text>
</svg>`;
}

// ── General process / how-to flowchart (ordered steps + optional iterate-back) ──
export interface ProcStep {
  title: string;
  sub: string;
}
export interface ProcFeedback {
  from: number; // 1-indexed
  to: number; // 1-indexed, < from
  label: string;
}
export interface ProcSpec {
  title: string;
  subtitle: string;
  steps: ProcStep[];
  feedback: ProcFeedback | null;
}

const PROC_FALLBACK: ProcSpec = {
  title: "How It Works",
  subtitle: "step by step",
  steps: [
    { title: "Start", sub: "" },
    { title: "Do the work", sub: "" },
    { title: "Review", sub: "" },
    { title: "Finish", sub: "" },
  ],
  feedback: null,
};

export async function planProcessFlow(searchIntent: string): Promise<ProcSpec> {
  const prompt =
    `Design the steps for a flowchart that answers: "${searchIntent}".\n` +
    `Give 4-7 ordered steps describing the actual process/workflow a user follows. If it is ` +
    `iterative (the user loops back to an earlier step to refine), set "feedback" to ` +
    `{from,to,label} (1-indexed, from > to); otherwise null.\n` +
    `Labels MUST be tiny: step title ≤4 words, sub ≤7 words, feedback label ≤4 words, subtitle ≤8 words.\n` +
    `Return JSON: {"title":"≤6 words","subtitle":"","steps":[{"title":"","sub":""}],"feedback":{"from":n,"to":n,"label":""}|null}`;
  const r = await completeJson<ProcSpec>(prompt, {
    system: "You design crisp, minimal labels for a how-to/workflow flowchart. Brevity is mandatory.",
  });
  return sanitizeProc(r);
}

function sanitizeProc(r: ProcSpec | null): ProcSpec {
  if (!r || !Array.isArray(r.steps) || r.steps.length < 3) return PROC_FALLBACK;
  const steps = r.steps.slice(0, 7).map((s) => ({
    title: String(s?.title || "Step").slice(0, 30),
    sub: String(s?.sub || "").slice(0, 46),
  }));
  let feedback: ProcFeedback | null = null;
  const fb = r.feedback;
  if (fb && Number.isFinite(fb.from) && Number.isFinite(fb.to)) {
    const from = Math.min(Math.max(1, Math.round(fb.from)), steps.length);
    const to = Math.min(Math.max(1, Math.round(fb.to)), steps.length);
    if (from > to) feedback = { from, to, label: String(fb.label || "refine").slice(0, 22) };
  }
  return {
    title: String(r.title || PROC_FALLBACK.title).slice(0, 48),
    subtitle: String(r.subtitle || "").slice(0, 52),
    steps,
    feedback,
  };
}

const PROC_COLORS: [string, string][] = [
  ["#eef2ff", "#6366f1"], ["#ecfeff", "#0891b2"], ["#faf5ff", "#9333ea"],
  ["#f0fdf4", "#16a34a"], ["#fff7ed", "#d97706"], ["#eff6ff", "#2563eb"], ["#fef2f2", "#dc2626"],
];

export function renderFlowSVG(s: ProcSpec): string {
  const W = 820, boxX = 270, boxW = 360, boxH = 66, gap = 98, startY = 86;
  const cx = boxX + boxW / 2;
  const n = s.steps.length;
  const H = startY + n * gap + 24;
  const yOf = (i: number): number => startY + i * gap;

  let body = "";
  s.steps.forEach((st, i) => {
    const [fill, stroke] = PROC_COLORS[i % PROC_COLORS.length] as [string, string];
    const y = yOf(i);
    body += `<rect x="${boxX}" y="${y}" width="${boxW}" height="${boxH}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="1.7"/>`;
    body += `<text x="${cx}" y="${y + (st.sub ? 27 : 38)}" text-anchor="middle" class="lbl">${i + 1}. ${esc(st.title)}</text>`;
    if (st.sub) body += `<text x="${cx}" y="${y + 47}" text-anchor="middle" class="sub">${esc(st.sub)}</text>`;
    if (i < n - 1) body += `<path class="edge" d="M${cx},${y + boxH} L${cx},${yOf(i + 1)}"/>`;
  });

  if (s.feedback) {
    const yFrom = yOf(s.feedback.from - 1) + boxH / 2;
    const yTo = yOf(s.feedback.to - 1) + boxH / 2;
    const lx = boxX - 64;
    const midY = (yFrom + yTo) / 2;
    body += `<path class="loop" d="M${boxX},${yFrom} C${lx},${yFrom} ${lx},${yTo} ${boxX},${yTo}"/>`;
    body += `<text x="${lx - 12}" y="${midY}" text-anchor="middle" class="tag" fill="#d97706" transform="rotate(-90 ${lx - 12} ${midY})">${esc(s.feedback.label)}</text>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Segoe UI, Arial, sans-serif">
  <defs>
    <marker id="ar" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 Z" fill="#475569"/></marker>
    <marker id="arA" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 Z" fill="#d97706"/></marker>
    <style>.lbl{font-size:15px;fill:#0f172a;font-weight:600}.sub{font-size:12px;fill:#475569}.edge{stroke:#475569;stroke-width:1.7;fill:none;marker-end:url(#ar)}.loop{stroke:#d97706;stroke-width:2;fill:none;stroke-dasharray:6 4;marker-end:url(#arA)}.tag{font-size:11px;font-weight:700}</style>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
  <text x="${W / 2}" y="40" text-anchor="middle" font-size="21" font-weight="800" fill="#0f172a">${esc(s.title)}</text>
  ${s.subtitle ? `<text x="${W / 2}" y="62" text-anchor="middle" class="sub">${esc(s.subtitle)}</text>` : ""}
  ${body}
</svg>`;
}
