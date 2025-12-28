import type { Question } from "./questions";

function shuffle<T>(arr: T[]) {
  // Fisher–Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Builds a deck of question IDs.
 * Avoids anything in avoidIds first; if pool is too small, it allows repeats only after exhausting.
 */
export function buildQuestionDeck(all: Question[], count: number, avoidIds: Set<string> = new Set()) {
  const fresh = all.filter((q) => !avoidIds.has(q.id));
  const deck: string[] = [];

  // Take as many fresh as possible
  shuffle(fresh);
  for (const q of fresh) {
    if (deck.length >= count) break;
    deck.push(q.id);
  }

  // If not enough, refill from full pool (meaning: you've exhausted uniqueness)
  if (deck.length < count) {
    const refill = shuffle([...all]);
    for (const q of refill) {
      if (deck.length >= count) break;
      if (!deck.includes(q.id)) deck.push(q.id);
    }
  }

  return deck;
}