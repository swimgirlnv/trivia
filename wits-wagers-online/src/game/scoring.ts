// Scoring logic
export const calculateScore = (wager: number, correct: boolean): number => {
  if (correct) return wager * 2;
  return 0;
};
