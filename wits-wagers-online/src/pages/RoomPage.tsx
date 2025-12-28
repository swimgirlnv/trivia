import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { updateDoc } from "firebase/firestore";
import { ensureAnonAuth, onAuth } from "../services/auth";
import {
  ensureRoundDoc,
  listenAnswers,
  listenBets,
  listenPlayers,
  listenRoom,
  hostSetPhase,
  hostSetQuestion,
  hostSetReveal,
  submitAnswer,
  upsertBets,
  batchUpdateWallets,
  roomDoc,
} from "../services/roomApi";
import { useRoomStore } from "../state/useRoomStore";
import { QUESTIONS } from "../game/questions";
import { arrangeAnswers } from "../game/arrange";
import { computeWinning } from "../game/winner";
import { applyPayout } from "../game/payout";
import { emptyStake, walletToPoints } from "../game/chips";
import { BettingMat } from "../ui/BettingMat";
import { ChipSelector } from "../ui/ChipSelector";
import { TimerBar } from "../ui/TimerBar";
import { BetMarker, SlotId } from "../game/types";
import { ensureSoloBots, runBotsAnswering, runBotsBetting } from "../bots/botEngine";
import { upsertBotPlayer } from "../services/roomApi";

const LS_NAME = "ww:name";

export function RoomPage() {
  const { roomId } = useParams();
  const { room, players, answers, bets, roundId, setRoom, setPlayers, setAnswers, setBets, setRoundId } = useRoomStore();
  const [uid, setUid] = useState<string | null>(null);

  const [myName, setMyName] = useState(() => localStorage.getItem(LS_NAME) ?? "");
  const [answerValue, setAnswerValue] = useState<number>(0);

  const [selectedMarkerIndex, setSelectedMarkerIndex] = useState<0 | 1>(0);
  const [myBetsLocal, setMyBetsLocal] = useState<BetMarker[]>([
    { markerIndex: 0, slotId: "P2", stake: emptyStake() },
    { markerIndex: 1, slotId: "P2", stake: emptyStake() },
  ]);

  useEffect(() => {
    (async () => {
      const u = await ensureAnonAuth();
      setUid(u.uid);
      if (roomId) {
        // upsert player
        const name = (localStorage.getItem(LS_NAME) ?? "Player").trim() || "Player";
        await import("../services/roomApi").then(({ upsertPlayer }) => upsertPlayer(roomId, u.uid, name));
      }
    })();
  }, [roomId]);

  useEffect(() => {
    return onAuth((u) => setUid(u?.uid ?? null));
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const unsubRoom = listenRoom(roomId, setRoom);
    const unsubPlayers = listenPlayers(roomId, setPlayers);
    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [roomId, setRoom, setPlayers]);

  // Determine roundId and subscribe to answers/bets
  useEffect(() => {
    if (!roomId || !room) return;

    let unsubA: (() => void) | null = null;
    let unsubB: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      const rid = await ensureRoundDoc(roomId, room.roundIndex);
      if (cancelled) return;
      setRoundId(rid);
      unsubA = listenAnswers(roomId, rid, setAnswers);
      unsubB = listenBets(roomId, rid, setBets);
    })();

    return () => {
      cancelled = true;
      unsubA?.();
      unsubB?.();
    };
  }, [roomId, room?.roundIndex]);

  // Update local name
  useEffect(() => localStorage.setItem(LS_NAME, myName), [myName]);

  const me = useMemo(() => players.find((p) => p.uid === uid) ?? null, [players, uid]);
  const isHost = useMemo(() => !!(room && uid && room.hostUid === uid), [room, uid]);

  useEffect(() => {
  if (!roomId || !room || !isHost) return;
  if (room.phase !== "LOBBY") return;

  ensureSoloBots({ roomId, players, upsertBotPlayer }).catch(console.error);
}, [roomId, room?.phase, isHost, players.length]);

  const arrangement = useMemo(() => arrangeAnswers(answers), [answers]);

  const myAnswer = useMemo(() => answers.find((a) => a.uid === uid)?.value ?? null, [answers, uid]);

  const myBetDoc = useMemo(() => bets.find((b) => b.uid === uid) ?? null, [bets, uid]);

  // keep local bets in sync if server changes
  useEffect(() => {
    if (!myBetDoc) return;
    if ((myBetDoc.bets?.length ?? 0) > 0) setMyBetsLocal(myBetDoc.bets as any);
  }, [myBetDoc?.updatedAt]);

  const roundQuestion = useMemo(() => {
    if (!room?.currentQuestion) return null;
    return room.currentQuestion;
  }, [room?.currentQuestion?.id]);

  const correctAnswer = useMemo(() => {
    if (!roundQuestion) return null;
    const q = QUESTIONS.find((x) => x.id === roundQuestion.id);
    return q?.answer ?? null;
  }, [roundQuestion?.id]);

  useEffect(() => {
  if (!roomId || !room || !roundId || !isHost) return;

  const q = room.currentQuestion ? QUESTIONS.find((x) => x.id === room.currentQuestion!.id) : null;
  const range = q?.botRange ?? [0, 100] as [number, number];

  if (room.phase === "ANSWERING") {
    runBotsAnswering({
      roomId,
      roundId,
      roundIndex: room.roundIndex,
      players,
      answers,
      questionRange: range,
      submitAnswer,
    }).catch(console.error);
  }

  if (room.phase === "BETTING") {
    runBotsBetting({
      roomId,
      roundId,
      roundIndex: room.roundIndex,
      players,
      bets,
      arrangementSlots: arrangement.slots,
      upsertBets,
    }).catch(console.error);
  }
}, [roomId, room?.phase, roundId, isHost, room?.roundIndex, players, answers, bets, arrangement]);

  const allAnswered = useMemo(() => {
    if (!players.length) return false;
    const uids = new Set(answers.map((a) => a.uid));
    return players.every((p) => uids.has(p.uid));
  }, [players, answers]);

  const canBetWithPokerChips = useMemo(() => (room?.roundIndex ?? 0) >= 1, [room?.roundIndex]);

  const phaseLabel = room?.phase ?? "…";

  if (!roomId) return <div className="card">Missing room id.</div>;
  if (!room) return <div className="card">Loading room…</div>;
  if (!uid) return <div className="card">Authenticating…</div>;

  async function hostStartRound() {
    const q = QUESTIONS[room.roundIndex % QUESTIONS.length];
    await hostSetQuestion(roomId, { id: q.id, prompt: q.prompt, unit: q.unit });
    await hostSetPhase(roomId, "QUESTION", Date.now() + 20_000);
    // then allow answering
    setTimeout(async () => {
      await hostSetPhase(roomId, "ANSWERING", Date.now() + 35_000);
    }, 400);
  }

  async function hostArrangeAndBet() {
    await hostSetPhase(roomId, "ARRANGE", Date.now() + 5_000);
    setTimeout(async () => {
      await hostSetPhase(roomId, "BETTING", Date.now() + 35_000);
    }, 300);
  }

  async function hostRevealAndPayout() {
    if (!correctAnswer) return;
    const { winningSlotId, winningGuessUid } = computeWinning(answers, correctAnswer, arrangement);
    await hostSetReveal(roomId, { correctAnswer, winningGuessUid, winningSlotId });
    await hostSetPhase(roomId, "REVEAL", Date.now() + 10_000);

    // apply payouts (host-authoritative MVP)
    const wallets = Object.fromEntries(players.map((p) => [p.uid, p.wallet]));
    const res = applyPayout({
      wallets,
      bets,
      winningSlotId,
      winningGuessUid,
      roundIndex: room.roundIndex,
    });

    await batchUpdateWallets(roomId, res.updatedWallets);

    await hostSetPhase(roomId, "PAYOUT", Date.now() + 12_000);

    setTimeout(async () => {
      const nextRound = room.roundIndex + 1;
      if (nextRound >= room.settings.totalRounds) {
        await hostSetPhase(roomId, "ENDED", null);
        return;
      }
      await updateDoc(roomDoc(roomId), { roundIndex: nextRound, currentQuestion: null, revealed: null });
      await hostSetPhase(roomId, "LOBBY", null);
    }, 600);
  }

  async function saveMyBets() {
    if (!roundId) return;
    // if round 1, force stake=0
    const cleaned = myBetsLocal.map((b) => ({
      ...b,
      stake: canBetWithPokerChips ? b.stake : { red: 0, blue: 0, green: 0 },
    }));
    await upsertBets(roomId, roundId, uid, cleaned);
  }

  function setMarkerSlot(markerIndex: 0 | 1, slotId: SlotId) {
    setMyBetsLocal((prev) => prev.map((b) => (b.markerIndex === markerIndex ? { ...b, slotId } : b)));
  }

  function setMarkerStake(markerIndex: 0 | 1, stake: { red: number; blue: number; green: number }) {
    setMyBetsLocal((prev) => prev.map((b) => (b.markerIndex === markerIndex ? { ...b, stake } : b)));
  }

  return (
    <div className="grid2">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Room</h2>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <span className="badge">Code: <strong>{roomId}</strong></span>
            <span className="badge">Phase: <strong>{phaseLabel}</strong></span>
            <span className="badge">Round: <strong>{room.roundIndex + 1}/{room.settings.totalRounds}</strong></span>
          </div>
        </div>

        <div className="spacer" />
        <TimerBar endsAtMs={room.phaseEndsAt ?? null} />

        <div className="spacer" />
        <div className="card" style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Players ({players.length}/{room.settings.maxPlayers})</h3>
          <div className="row" style={{ gap: 8 }}>
            {players.map((p) => (
              <span key={p.uid} className="pill" title={p.uid}>
                {p.uid === room.hostUid ? "👑 " : ""}
                {p.name}
                <span className="muted">· {walletToPoints(p.wallet)} pts</span>
              </span>
            ))}
          </div>
        </div>

        <div className="spacer" />

        <div className="card" style={{ padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Your name</h3>
          <div className="row">
            <input value={myName} onChange={(e) => setMyName(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
            <button
              onClick={async () => {
                localStorage.setItem(LS_NAME, myName);
                await import("../services/roomApi").then(({ upsertPlayer }) => upsertPlayer(roomId, uid, myName.trim() || "Player"));
              }}
            >
              Update
            </button>
          </div>
        </div>

        <div className="spacer" />

        {/* Phase UI */}
        {room.phase === "LOBBY" && (
          <div className="card" style={{ padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Lobby</h3>
            <div className="muted" style={{ fontSize: 12 }}>
              Host: start the next question when everyone is ready.
            </div>
            <div className="spacer" />
            <button className="primary" disabled={!isHost || players.length < 3} onClick={hostStartRound}>
              Start round
            </button>
            {players.length < 3 && <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>Need at least 3 players.</div>}
          </div>
        )}

        {room.phase === "QUESTION" && (
          <div className="card" style={{ padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Question</h3>
            {roundQuestion ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{roundQuestion.prompt}</div>
                {roundQuestion.unit && <div className="muted" style={{ marginTop: 6 }}>Unit: {roundQuestion.unit}</div>}
                <div className="spacer" />
                <div className="muted" style={{ fontSize: 12 }}>
                  Think of a number. You’ll submit privately next.
                </div>
              </>
            ) : (
              <div className="muted">Waiting for host…</div>
            )}
          </div>
        )}

        {room.phase === "ANSWERING" && (
          <div className="card" style={{ padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Submit your answer</h3>
            <div className="row">
              <input
                type="number"
                value={answerValue}
                onChange={(e) => setAnswerValue(Number(e.target.value))}
                style={{ width: 200 }}
              />
              <button
                className="primary"
                disabled={!roundId}
                onClick={async () => {
                  if (!roundId) return;
                  await submitAnswer(roomId, roundId, uid, answerValue);
                }}
              >
                Submit
              </button>
            </div>
            {myAnswer != null && <div className="muted" style={{ marginTop: 8 }}>Submitted: <strong>{myAnswer}</strong></div>}

            <div className="spacer" />
            {isHost && (
              <button disabled={!allAnswered} onClick={hostArrangeAndBet}>
                Arrange &amp; start betting
              </button>
            )}
            {isHost && !allAnswered && (
              <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                Waiting for everyone to answer…
              </div>
            )}
          </div>
        )}

        {room.phase === "ARRANGE" && (
          <div className="card" style={{ padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Arranging answers…</h3>
            <div className="muted">Answers are now visible on the betting mat.</div>
          </div>
        )}

        {room.phase === "BETTING" && (
          <div className="card" style={{ padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Place your bets</h3>
            <div className="muted" style={{ fontSize: 12 }}>
              You have <strong>two markers</strong>. Each marker counts as +1 stake automatically. {canBetWithPokerChips ? "You can add poker chips too." : "Round 1: no poker chips yet."}
            </div>

            <div className="spacer" />
            <div className="row">
              <span className="pill">Select marker</span>
              <button onClick={() => setSelectedMarkerIndex(0)} className={selectedMarkerIndex === 0 ? "primary" : ""}>
                Marker 1
              </button>
              <button onClick={() => setSelectedMarkerIndex(1)} className={selectedMarkerIndex === 1 ? "primary" : ""}>
                Marker 2
              </button>
              <button onClick={saveMyBets}>Save bets</button>
            </div>

            <div className="spacer" />
            {me && (
              <>
                <div className="chips">
                  <span className="chip">Wallet: {walletToPoints(me.wallet)} pts</span>
                  <span className="chip">red {me.wallet.red}</span>
                  <span className="chip">blue {me.wallet.blue}</span>
                  <span className="chip">green {me.wallet.green}</span>
                </div>

                <div className="spacer" />
                {myBetsLocal.map((b) => (
                  <div key={b.markerIndex} className="card" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <strong>Marker {b.markerIndex + 1}</strong>
                      <span className="muted">Slot: {b.slotId}</span>
                    </div>
                    <div className="spacer" />
                    <ChipSelector
                      wallet={me.wallet}
                      value={b.stake}
                      onChange={(stake) => setMarkerStake(b.markerIndex, stake)}
                      disabled={!canBetWithPokerChips}
                    />
                  </div>
                ))}
              </>
            )}

            <div className="spacer" />
            {isHost && (
              <button className="primary" onClick={hostRevealAndPayout} disabled={!correctAnswer}>
                Reveal answer &amp; pay out
              </button>
            )}
          </div>
        )}

        {room.phase === "REVEAL" && (
          <div className="card" style={{ padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Reveal</h3>
            {room.revealed ? (
              <>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  Correct answer: {room.revealed.correctAnswer}
                </div>
                <div className="muted" style={{ marginTop: 6 }}>
                  Winning slot: <strong>{room.revealed.winningSlotId ?? "—"}</strong>
                </div>
              </>
            ) : (
              <div className="muted">Waiting for host…</div>
            )}
          </div>
        )}

        {room.phase === "PAYOUT" && (
          <div className="card" style={{ padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Payout</h3>
            <div className="muted">Scores updated. Next round starting soon…</div>
          </div>
        )}

        {room.phase === "ENDED" && (
          <div className="card" style={{ padding: 12 }}>
            <h3 style={{ marginTop: 0 }}>Game over</h3>
            <div className="muted">Winner is whoever has the most points.</div>
          </div>
        )}
      </div>

      {/* Right column: Betting mat always visible once answers exist */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(room.phase === "ARRANGE" || room.phase === "BETTING" || room.phase === "REVEAL" || room.phase === "PAYOUT" || room.phase === "ENDED") && (
          <BettingMat
            arrangement={arrangement}
            bets={bets}
            players={players}
            meUid={uid}
            selectedMarkerIndex={selectedMarkerIndex}
            onPickSlot={room.phase === "BETTING" ? setMarkerSlot : undefined}
            winningSlotId={(room.revealed?.winningSlotId as SlotId | null) ?? null}
          />
        )}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>How to play (digital)</h3>
          <ol className="muted" style={{ marginTop: 0, paddingLeft: 18, fontSize: 13 }}>
            <li>Answer a numeric trivia question.</li>
            <li>Answers are sorted onto the mat.</li>
            <li>Place up to two bets. Each marker counts as +1 stake.</li>
            <li>From Round 2+, add poker chips under markers to increase winnings.</li>
            <li>Winning guess = closest without going over; if all are over, “All too high” wins.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
