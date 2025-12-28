// Game types
export type Player = {
  id: string;
  name: string;
  score: number;
};

export type Room = {
  id: string;
  players: Player[];
  phase: string;
};
