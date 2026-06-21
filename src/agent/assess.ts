// ASSESS: the loop's stop/continue decision — the heart of Phase 1 (BUILD_SPEC §3).
// STOP when ANY is true:
//   1. score >= TARGET, OR
//   2. round >= MAX_ROUNDS, OR
//   3. gain vs. previous round < MIN_GAIN (diminishing returns).
import { config } from "../config";

export interface AssessInput {
  round: number;
  score: number;
  prevScore: number | null; // null on the first round
}

export interface Decision {
  stop: boolean;
  reason: string;
}

export function assess({ round, score, prevScore }: AssessInput): Decision {
  if (score >= config.TARGET) {
    return { stop: true, reason: `score ${score} ≥ target ${config.TARGET}` };
  }
  if (round >= config.MAX_ROUNDS) {
    return { stop: true, reason: `reached MAX_ROUNDS (${config.MAX_ROUNDS})` };
  }
  if (prevScore !== null && score - prevScore < config.MIN_GAIN) {
    return {
      stop: true,
      reason: `plateau: gain ${score - prevScore} < MIN_GAIN ${config.MIN_GAIN}`,
    };
  }
  return { stop: false, reason: `score ${score} < target ${config.TARGET}; refine & continue` };
}
