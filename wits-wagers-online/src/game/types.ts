export type Phase =
  | "LOBBY"
  | "QUESTION"
  | "ANSWERING"
  | "ARRANGE"
  | "BETTING"
  | "REVEAL"
  | "PAYOUT"
  | "ENDED";

export type ChipWallet = { red: number; blue: number; green: number };

export type Player = {
  uid: string;
  name: string;
  totalPoints: number; // convenience; equals wallet value in points
  wallet: ChipWallet; // chips earned (rounds 2-7)
  joinedAt: number;

  isBot?: boolean;
  botLevel?: "easy" | "medium" | "hard";
};

export type RoomSettings = {
  maxPlayers: number; // 10
  totalRounds: number; // default 7
};

export type Room = {
  id: string;
  hostUid: string;
  phase: Phase;
  roundIndex: number; // 0-based
  phaseEndsAt?: number | null; // ms epoch
  settings: RoomSettings;
  currentQuestion?: {
    id: string;
    prompt: string;
    unit?: string;
  } | null;
  revealed?: {
    correctAnswer: number;
    winningGuessUid?: string | null;
    winningSlotId?: SlotId | null;
  } | null;
};

export type Answer = { uid: string; value: number; submittedAt: number };
export type SlotId =
  | "ALL_TOO_HIGH"
  | "P6L"
  | "P5L"
  | "P4L"
  | "P3L"
  | "P2"
  | "P3R"
  | "P4R"
  | "P5R"
  | "P6R";

export const SLOT_ORDER: SlotId[] = [
  "ALL_TOO_HIGH",
  "P6L",
  "P5L",
  "P4L",
  "P3L",
  "P2",
  "P3R",
  "P4R",
  "P5R",
  "P6R",
];

export const SLOT_ODDS: Record<SlotId, number> = {
  ALL_TOO_HIGH: 6,
  P6L: 6,
  P5L: 5,
  P4L: 4,
  P3L: 3,
  P2: 2,
  P3R: 3,
  P4R: 4,
  P5R: 5,
  P6R: 6,
};

export type BetStake = { red: number; blue: number; green: number }; // poker chips only (not counting betting marker)

export type BetMarker = {
  markerIndex: 0 | 1;
  slotId: SlotId;
  stake: BetStake; // only allowed from round 2+
};

export type BetDoc = {
  uid: string;
  bets: BetMarker[]; // up to 2
  updatedAt: number;
};

export type ArrangedSlot = {
  slotId: SlotId;
  answers: { uid: string; value: number }[]; // may stack duplicates
};

export type Arrangement = {
  slots: Record<SlotId, ArrangedSlot>;
  // for quick lookup: which slot a particular uid's answer ended up in (first occurrence)
  uidToSlot: Record<string, SlotId>;
};

/**
 * 10 highly distinct colors (works great on dark backgrounds).
 * Order is intentional: high contrast adjacency.
 */
const PALETTE_10 = [
  "#4CC9F0", // cyan
  "#F72585", // pink
  "#B9FBC0", // mint
  "#F9C74F", // gold
  "#A78BFA", // violet
  "#FB7185", // rose
  "#34D399", // green
  "#60A5FA", // blue
  "#F97316", // orange
  "#FDE047", // yellow
] as const;

/**
 * Guaranteed unique mapping for the *current room* up to 10 players.
 * Stable as long as the set/order of player uids is stable.
 */
export function getPlayerColorMap(players: Player[]) {
  // stable ordering regardless of join timing
  const ids = [...players].map((p) => p.uid).sort();
  const map: Record<string, string> = {};
  ids.forEach((uid, i) => {
    map[uid] = PALETTE_10[i % PALETTE_10.length];
  });
  return map;
}

export function initials(name: string) {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}