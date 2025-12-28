import { BetMarker, SlotId } from "../game/types";
import { emptyStake, walletToPoints } from "../game/chips";
import { Player, Answer, BetDoc } from "../game/types";
import { botName } from "./botNames";

const SOLO_BOT_COUNT = 5; // 👈 your “X”
const BOT_UID_PREFIX = "bot_";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(roomId: string, roundIndex: number, botUid: string) {
  let h = 2166136261;
  const s = `${roomId}|${roundIndex}|${botUid}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getHumanCount(players: Player[]) {
  return players.filter((p) => !p.isBot).length;
}

export function getBots(players: Player[]) {
  return players.filter((p) => !!p.isBot);
}

export function desiredBotCount(players: Player[]) {
  // ✅ Only spawn bots when exactly one human is present
  return getHumanCount(players) === 1 ? SOLO_BOT_COUNT : 0;
}

export async function ensureSoloBots(params: {
  roomId: string;
  players: Player[];
  upsertBotPlayer: (roomId: string, bot: { uid: string; name: string; botLevel: "easy" | "medium" | "hard" }) => Promise<void>;
}) {
  const { roomId, players, upsertBotPlayer } = params;

  const want = desiredBotCount(players);
  const existingBots = getBots(players).length;

  const missing = Math.max(0, want - existingBots);
  if (missing === 0) return;

  // Don’t exceed max players (room setting is 10; we’ll keep it safe anyway)
  const roomCap = 10;
  const availableSlots = Math.max(0, roomCap - players.length);
  const toCreate = Math.min(missing, availableSlots);

  for (let i = 0; i < toCreate; i++) {
    const botIndex = existingBots + i;
    const uid = `${BOT_UID_PREFIX}${botIndex}`;
    const level: "easy" | "medium" | "hard" =
      botIndex % 7 === 0 ? "hard" : botIndex % 3 === 0 ? "medium" : "easy";

    await upsertBotPlayer(roomId, { uid, name: botName(botIndex), botLevel: level });
  }
}

// -------- Bot answering + betting --------

function pickBotAnswer(params: {
  roomId: string;
  roundIndex: number;
  bot: Player;
  // supply a reasonable numeric range for the question (recommended)
  range: [number, number];
}) {
  const { roomId, roundIndex, bot, range } = params;
  const [lo, hi] = range;
  const rand = mulberry32(seedFrom(roomId, roundIndex, bot.uid));

  // triangular-ish distribution around the midpoint (feels human)
  const x = (rand() + rand()) / 2; // 0..1 centered ~0.5
  let v = lo + x * (hi - lo);

  // difficulty tweaks
  if (bot.botLevel === "easy") v = lo + (rand() ** 0.8) * (hi - lo);
  if (bot.botLevel === "hard") v = lo + ((x * 0.6 + 0.2) * (hi - lo)); // narrower

  // numeric trivia usually integer
  return Math.round(v);
}

function scoreSlot(slotId: SlotId, idx: number, n: number) {
  // bias toward ~70th percentile (close without going over tends to be “high-ish”)
  const target = Math.floor(0.7 * Math.max(0, n - 1));
  const dist = Math.abs(idx - target);
  const base = 1 / (1 + dist);
  // odds matter, but don’t let 6:1 extremes dominate too hard
  const oddsWeight = slotId === "ALL_TOO_HIGH" ? 0.6 : 1.0;
  return base * oddsWeight;
}

function pickBotSlots(sortedSlots: { slotId: SlotId; repValue: number }[], rand: () => number) {
  const n = sortedSlots.length;
  if (n === 0) return ["P2", "P2"] as [SlotId, SlotId];

  const scored = sortedSlots.map((s, i) => ({ ...s, s: scoreSlot(s.slotId, i, n) }));
  scored.sort((a, b) => b.s - a.s);

  const first = scored[0]?.slotId ?? "P2";
  // second: either same slot (stack) or next best
  const second = rand() < 0.55 ? first : (scored[1]?.slotId ?? first);
  return [first, second] as [SlotId, SlotId];
}

function pickStake(walletPoints: number, level: Player["botLevel"], rand: () => number) {
  // keep bots fairly conservative: mostly red/blue, rarely green
  if (walletPoints <= 0) return emptyStake();

  const stake = emptyStake();

  if (level === "hard" && walletPoints >= 10 && rand() < 0.35) stake.blue = 1; // 5 pts
  if (walletPoints >= 3 && rand() < 0.6) stake.red = Math.min(3, walletPoints); // up to 3 pts
  if (walletPoints >= 25 && level === "hard" && rand() < 0.05) stake.green = 1; // rare

  return stake;
}

export async function runBotsAnswering(params: {
  roomId: string;
  roundId: string;
  roundIndex: number;
  players: Player[];
  answers: Answer[];
  questionRange: [number, number];
  submitAnswer: (roomId: string, roundId: string, uid: string, value: number) => Promise<void>;
}) {
  const { roomId, roundId, roundIndex, players, answers, questionRange, submitAnswer } = params;

  const bots = getBots(players);
  const answered = new Set(answers.map((a) => a.uid));

  for (const bot of bots) {
    if (answered.has(bot.uid)) continue;
    const val = pickBotAnswer({ roomId, roundIndex, bot, range: questionRange });
    await submitAnswer(roomId, roundId, bot.uid, val);
  }
}

export async function runBotsBetting(params: {
  roomId: string;
  roundId: string;
  roundIndex: number;
  players: Player[];
  bets: BetDoc[];
  // arrangement slots: slotId -> answers
  arrangementSlots: Record<SlotId, { slotId: SlotId; answers: { uid: string; value: number }[] }>;
  upsertBets: (roomId: string, roundId: string, uid: string, bets: BetMarker[]) => Promise<void>;
}) {
  const { roomId, roundId, roundIndex, players, bets, arrangementSlots, upsertBets } = params;

  const bots = getBots(players);
  const alreadyBet = new Set(bets.map((b) => b.uid));

  // Build list of slots that actually contain answers (exclude ALL_TOO_HIGH unless it has answers)
  const slotList = Object.values(arrangementSlots)
    .filter((s) => s.answers.length > 0)
    .map((s) => {
      const vals = s.answers.map((a) => a.value).sort((a, b) => a - b);
      const repValue = vals[Math.floor(vals.length / 2)];
      return { slotId: s.slotId, repValue };
    })
    .sort((a, b) => a.repValue - b.repValue);

  for (const bot of bots) {
    if (alreadyBet.has(bot.uid)) continue;

    const rand = mulberry32(seedFrom(roomId, roundIndex, bot.uid) ^ 0x9e3779b9);
    const [s1, s2] = pickBotSlots(slotList, rand);

    const canUsePokerChips = roundIndex >= 1;
    const walletPoints = walletToPoints(bot.wallet);

    const stake1 = canUsePokerChips ? pickStake(walletPoints, bot.botLevel, rand) : emptyStake();
    const stake2 = canUsePokerChips ? pickStake(Math.max(0, walletPoints - 3), bot.botLevel, rand) : emptyStake();

    const botBets: BetMarker[] = [
      { markerIndex: 0, slotId: s1, stake: stake1 },
      { markerIndex: 1, slotId: s2, stake: stake2 },
    ];

    await upsertBets(roomId, roundId, bot.uid, botBets);
  }
}