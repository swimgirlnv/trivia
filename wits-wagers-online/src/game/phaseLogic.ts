// Game phase logic
export const getNextPhase = (currentPhase: string): string => {
  const phases = ['lobby', 'question', 'answer', 'wager', 'reveal', 'score'];
  const idx = phases.indexOf(currentPhase);
  return phases[(idx + 1) % phases.length];
};
