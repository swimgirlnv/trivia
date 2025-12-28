import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { Answer, BetDoc, Phase, Player, Room } from "../game/types";
import { walletToPoints } from "../game/chips";

const roomsCol = collection(db, "rooms");

export function roomDoc(roomId: string) {
  return doc(db, "rooms", roomId);
}

export function playersCol(roomId: string) {
  return collection(db, "rooms", roomId, "players");
}
export function roundsCol(roomId: string) {
  return collection(db, "rooms", roomId, "rounds");
}
export function answersCol(roomId: string, roundId: string) {
  return collection(db, "rooms", roomId, "rounds", roundId, "answers");
}
export function betsCol(roomId: string, roundId: string) {
  return collection(db, "rooms", roomId, "rounds", roundId, "bets");
}

export async function createRoom(params: { hostUid: string; hostName: string }) {
  const { hostUid, hostName } = params;

  // Create room with random-ish short code (doc id)
  const roomRef = doc(roomsCol); // auto-id
  const room: Omit<Room, "id"> = {
    hostUid,
    phase: "LOBBY",
    roundIndex: 0,
    phaseEndsAt: null,
    settings: { maxPlayers: 10, totalRounds: 7 },
    currentQuestion: null,
    revealed: null,
  };

  await setDoc(roomRef, room);

  // Create host player doc
  await setDoc(doc(playersCol(roomRef.id), hostUid), {
    uid: hostUid,
    name: hostName || "Host",
    wallet: { red: 0, blue: 0, green: 0 },
    totalPoints: 0,
    joinedAt: Date.now(),
    isBot: false,
  });

  return roomRef.id;
}

export async function upsertPlayer(roomId: string, uid: string, name: string) {
  const ref = doc(playersCol(roomId), uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { name });
  } else {
    await setDoc(ref, {
      uid,
      name,
      wallet: { red: 0, blue: 0, green: 0 },
      totalPoints: 0,
      joinedAt: Date.now(),
      isBot: false,
    });
  }
}

export function listenRoom(roomId: string, cb: (room: Room | null) => void) {
  return onSnapshot(roomDoc(roomId), (snap) => {
    if (!snap.exists()) return cb(null);
    cb({ id: snap.id, ...(snap.data() as any) } as Room);
  });
}

export function listenPlayers(roomId: string, cb: (players: Player[]) => void) {
  const q = query(playersCol(roomId), orderBy("joinedAt", "asc"));
  return onSnapshot(q, (snap) => {
    const out: Player[] = snap.docs.map((d) => d.data() as any);
    cb(out);
  });
}

export function listenAnswers(roomId: string, roundId: string, cb: (answers: Answer[]) => void) {
  const q = query(answersCol(roomId, roundId), orderBy("submittedAt", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data() as any));
  });
}

export function listenBets(roomId: string, roundId: string, cb: (bets: BetDoc[]) => void) {
  const q = query(betsCol(roomId, roundId), orderBy("updatedAt", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data() as any));
  });
}

export async function hostSetPhase(roomId: string, phase: Phase, phaseEndsAt: number | null) {
  await updateDoc(roomDoc(roomId), { phase, phaseEndsAt });
}

export async function hostSetQuestion(roomId: string, q: { id: string; prompt: string; unit?: string }) {
  await updateDoc(roomDoc(roomId), { currentQuestion: q, revealed: null });
}

export async function hostSetReveal(roomId: string, payload: { correctAnswer: number; winningGuessUid: string | null; winningSlotId: string | null }) {
  await updateDoc(roomDoc(roomId), { revealed: payload });
}

export async function ensureRoundDoc(roomId: string, roundIndex: number) {
  const roundId = `round-${roundIndex}`;
  const ref = doc(roundsCol(roomId), roundId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { roundIndex, createdAt: Date.now() });
  }
  return roundId;
}

export async function submitAnswer(roomId: string, roundId: string, uid: string, value: number) {
  await setDoc(doc(answersCol(roomId, roundId), uid), {
    uid,
    value,
    submittedAt: Date.now(),
  });
}

export async function upsertBets(roomId: string, roundId: string, uid: string, bets: BetDoc["bets"]) {
  await setDoc(doc(betsCol(roomId, roundId), uid), {
    uid,
    bets,
    updatedAt: Date.now(),
  });
}

export async function batchUpdateWallets(roomId: string, wallets: Record<string, { red: number; blue: number; green: number }>) {
  const batch = writeBatch(db);
  for (const [uid, wallet] of Object.entries(wallets)) {
    const totalPoints = walletToPoints(wallet);
    batch.update(doc(playersCol(roomId), uid), { wallet, totalPoints });
  }
  await batch.commit();
}


export async function canJoinRoom(roomId: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const rSnap = await getDoc(roomDoc(roomId));
  if (!rSnap.exists()) return { ok: false, reason: "Room not found" };
  const room = rSnap.data() as any;
  const maxPlayers = room?.settings?.maxPlayers ?? 10;

  const pSnap = await getDocs(query(playersCol(roomId)));
  if (pSnap.size >= maxPlayers) return { ok: false, reason: "Room is full" };

  return { ok: true };
}

export async function upsertBotPlayer(roomId: string, bot: {
  uid: string;
  name: string;
  botLevel: "easy" | "medium" | "hard";
}) {
  const ref = doc(playersCol(roomId), bot.uid);
  const snap = await getDoc(ref);

  const payload = {
    uid: bot.uid,
    name: bot.name,
    wallet: { red: 0, blue: 0, green: 0 },
    totalPoints: 0,
    joinedAt: Date.now(),
    isBot: true,
    botLevel: bot.botLevel,
  };

  if (snap.exists()) {
    await updateDoc(ref, { name: bot.name, isBot: true, botLevel: bot.botLevel });
  } else {
    await setDoc(ref, payload);
  }
}
