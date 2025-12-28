import { Answer, Arrangement, SlotId } from "./types";

/**
 * Winning guess = closest to the correct answer WITHOUT going over.
 * If all guesses are over, winning slot is ALL_TOO_HIGH (special).
 */
export function computeWinning(
  answers: Answer[],
  correctAnswer: number,
  arrangement: Arrangement
): { winningSlotId: SlotId; winningGuessUid: string | null } {
  if (answers.length === 0) return { winningSlotId: "ALL_TOO_HIGH", winningGuessUid: null };

  // Find best <= correct
  let best: Answer | null = null;
  for (const a of answers) {
    if (a.value <= correctAnswer) {
      if (!best || a.value > best.value) best = a;
    }
  }

  if (!best) {
    return { winningSlotId: "ALL_TOO_HIGH", winningGuessUid: null };
  }

  const slot = arrangement.uidToSlot[best.uid] ?? "P2";
  return { winningSlotId: slot, winningGuessUid: best.uid };
}
