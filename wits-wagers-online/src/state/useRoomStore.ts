import { create } from "zustand";
import { Answer, BetDoc, Player, Room } from "../game/types";

type RoomState = {
  room: Room | null;
  players: Player[];
  answers: Answer[];
  bets: BetDoc[];
  roundId: string | null;
  setRoom: (r: Room | null) => void;
  setPlayers: (p: Player[]) => void;
  setAnswers: (a: Answer[]) => void;
  setBets: (b: BetDoc[]) => void;
  setRoundId: (id: string | null) => void;
};

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  players: [],
  answers: [],
  bets: [],
  roundId: null,
  setRoom: (room) => set({ room }),
  setPlayers: (players) => set({ players }),
  setAnswers: (answers) => set({ answers }),
  setBets: (bets) => set({ bets }),
  setRoundId: (roundId) => set({ roundId }),
}));
