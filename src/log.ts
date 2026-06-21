// Lightweight console logging. The structured per-run record (queries, sources
// found/rejected, scores per round, decision) is assembled by researchAgent.ts
// and persisted alongside the scorecard in output/eval-reports/.
const DEBUG = process.env.PULSE_DEBUG === "1" || process.env.DEBUG === "1";

function stamp(): string {
  return new Date().toISOString().slice(11, 19);
}

function emit(badge: string, msg: string, data?: unknown): void {
  const line = `[${stamp()}] ${badge} ${msg}`;
  if (data === undefined) console.log(line);
  else console.log(line, typeof data === "string" ? data : JSON.stringify(data));
}

export const log = {
  info: (msg: string, data?: unknown) => emit("·", msg, data),
  step: (msg: string, data?: unknown) => emit("▶", msg, data),
  ok: (msg: string, data?: unknown) => emit("✓", msg, data),
  warn: (msg: string, data?: unknown) => emit("⚠", msg, data),
  error: (msg: string, data?: unknown) => emit("✗", msg, data),
  debug: (msg: string, data?: unknown) => {
    if (DEBUG) emit("…", msg, data);
  },
};
