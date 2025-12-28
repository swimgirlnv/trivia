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

  const {
    room,
    players,
    answers,
    bets,
    roundId,
    setRoom,
    setPlayers,
    setAnswers,
    setBets,
    setRoundId,
  } = useRoomStore();

  const [uid, setUid] = useState<string | null>(null);

  const [myName, setMyName] = useState(() => localStorage.getItem(LS_NAME) ?? "");
  const [answerValue, setAnswerValue] = useState<number>(0);

  const [selectedMarkerIndex, setSelectedMarkerIndex] = useState<0 | 1>(0);
  const [myBetsLocal, setMyBetsLocal] = useState<BetMarker[]>([
    { markerIndex: 0, slotId: "P2", stake: emptyStake() },
    { markerIndex: 1, slotId: "P2", stake: emptyStake() },
  ]);

  // Auth + join room
  useEffect(() => {
    (async () => {
      const u = await ensureAnonAuth();
      setUid(u.uid);

      if (roomId) {
        const name = (localStorage.getItem(LS_NAME) ?? "Player").trim() || "Player";
        const { upsertPlayer } = await import("../services/roomApi");
        await upsertPlayer(roomId, u.uid, name);
      }
    })();
  }, [roomId]);

  useEffect(() => {
    return onAuth((u) => setUid(u?.uid ?? null));
  }, []);

  // Room + player listeners
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
  }, [roomId, room?.roundIndex, setRoundId, setAnswers, setBets, room]);

  // Persist local name
  useEffect(() => localStorage.setItem(LS_NAME, myName), [myName]);

  const me = useMemo(() => players.find((p) => p.uid === uid) ?? null, [players, uid]);
  const isHost = useMemo(() => !!(room && uid && room.hostUid === uid), [room, uid]);

  // Solo bots
  useEffect(() => {
    if (!roomId || !room || !isHost) return;
    if (room.phase !== "LOBBY") return;
    ensureSoloBots({ roomId, players, upsertBotPlayer }).catch(console.error);
  }, [roomId, room?.phase, isHost, players]);

  const arrangement = useMemo(() => arrangeAnswers(answers), [answers]);

  const myAnswer = useMemo(() => answers.find((a) => a.uid === uid)?.value ?? null, [answers, uid]);
  const myBetDoc = useMemo(() => bets.find((b) => b.uid === uid) ?? null, [bets, uid]);

  // Keep local bets synced to server
  useEffect(() => {
    if (!myBetDoc) return;
    if ((myBetDoc.bets?.length ?? 0) > 0) setMyBetsLocal(myBetDoc.bets as any);
  }, [myBetDoc?.updatedAt, myBetDoc]);

  const roundQuestion = useMemo(() => {
    if (!room?.currentQuestion) return null;
    return room.currentQuestion;
  }, [room?.currentQuestion?.id, room?.currentQuestion]);

  const correctAnswer = useMemo(() => {
    if (!roundQuestion) return null;
    const q = QUESTIONS.find((x) => x.id === roundQuestion.id);
    return q?.answer ?? null;
  }, [roundQuestion?.id, roundQuestion]);

  // Bot play
  useEffect(() => {
    if (!roomId || !room || !roundId || !isHost) return;

    const q = room.currentQuestion ? QUESTIONS.find((x) => x.id === room.currentQuestion!.id) : null;
    const range = q?.botRange ?? ([0, 100] as [number, number]);

    if (room.phase === "ANSWERING") {
      runBotsAnswering({
        roomId,
        roundId,
        roundIndex: room.roundIndex ?? 0,
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
        roundIndex: room.roundIndex ?? 0,
        players,
        bets,
        arrangementSlots: arrangement.slots,
        upsertBets,
      }).catch(console.error);
    }
  }, [roomId, room, roundId, isHost, players, answers, bets, arrangement]);

  const allAnswered = useMemo(() => {
    if (!players.length) return false;
    const uids = new Set(answers.map((a) => a.uid));
    return players.every((p) => uids.has(p.uid));
  }, [players, answers]);

  const canBetWithPokerChips = useMemo(() => (room?.roundIndex ?? 0) >= 1, [room?.roundIndex]);

  const PHASE_ORDER = ["LOBBY", "QUESTION", "ANSWERING", "ARRANGE", "BETTING", "REVEAL", "PAYOUT", "ENDED"] as const;

  const PHASE_META: Record<string, { title: string; subtitle: string; intent: "idle" | "think" | "act" | "resolve" }> =
    {
      LOBBY: { title: "Lobby", subtitle: "Get ready — host will start the next question.", intent: "idle" },
      QUESTION: { title: "Question", subtitle: "Read the prompt and think of a number.", intent: "think" },
      ANSWERING: { title: "Submit Answer", subtitle: "Enter your best guess (hidden until reveal).", intent: "act" },
      ARRANGE: { title: "Arrange", subtitle: "Answers are being placed on the mat.", intent: "idle" },
      BETTING: { title: "Betting", subtitle: "Place two markers, then add chips if available.", intent: "act" },
      REVEAL: { title: "Reveal", subtitle: "Correct answer revealed — see the winning slot.", intent: "resolve" },
      PAYOUT: { title: "Payout", subtitle: "Wallets updated — next round soon.", intent: "resolve" },
      ENDED: { title: "Game Over", subtitle: "Highest points wins.", intent: "resolve" },
    };

  function Stepper({ phase }: { phase: string }) {
    const idx = Math.max(0, PHASE_ORDER.indexOf(phase as any));
    return (
      <div className="stepper">
        {PHASE_ORDER.map((p, i) => (
          <div key={p} className={`step ${i < idx ? "done" : ""} ${i === idx ? "active" : ""}`}>
            <div className="dot" />
            <div className="label">{p}</div>
          </div>
        ))}
      </div>
    );
  }

  const phaseLabel = room?.phase ?? "…";

  // Early returns (NO hooks below this point)
  if (!roomId) return <div className="card">Missing room id.</div>;
  if (!room) return <div className="card">Loading room…</div>;
  if (!uid) return <div className="card">Authenticating…</div>;

  // Capture as non-null strings so TS is happy inside closures/handlers
  const roomIdStr: string = roomId;
  const uidStr: string = uid;

  // Computed values (no hooks)
  const phase = room.phase;
  const meta = PHASE_META[phase] ?? { title: phaseLabel, subtitle: "", intent: "idle" };

  const answeredCount = (() => {
    const uids = new Set(answers.map((a) => a.uid));
    return players.reduce((acc, p) => acc + (uids.has(p.uid) ? 1 : 0), 0);
  })();

  const betCount = (() => {
    const uids = new Set(bets.map((b) => b.uid));
    return players.reduce((acc, p) => acc + (uids.has(p.uid) ? 1 : 0), 0);
  })();

  const myBetsSaved = (myBetDoc?.bets?.length ?? 0) > 0;

  async function hostStartRound() {
    const r = room; // capture
    if (!r) return;

    const q = QUESTIONS[r.roundIndex % QUESTIONS.length];
    if (!q?.id || !q?.prompt) throw new Error("Question is missing id or prompt");

    await hostSetQuestion(roomIdStr, { id: q.id, prompt: q.prompt, unit: q.unit });
    await hostSetPhase(roomIdStr, "QUESTION", Date.now() + 20_000);

    setTimeout(async () => {
      await hostSetPhase(roomIdStr, "ANSWERING", Date.now() + 35_000);
    }, 400);
  }

  async function hostArrangeAndBet() {
    await hostSetPhase(roomIdStr, "ARRANGE", Date.now() + 5_000);
    setTimeout(async () => {
      await hostSetPhase(roomIdStr, "BETTING", Date.now() + 35_000);
    }, 300);
  }

  async function hostRevealAndPayout() {
    const r = room; // capture
    if (!r) return;
    if (!correctAnswer) return;

    const roundIndexNow = r.roundIndex;
    const totalRounds = r.settings.totalRounds;

    const { winningSlotId, winningGuessUid } = computeWinning(answers, correctAnswer, arrangement);

    await hostSetReveal(roomIdStr, { correctAnswer, winningGuessUid, winningSlotId });
    await hostSetPhase(roomIdStr, "REVEAL", Date.now() + 10_000);

    const wallets = Object.fromEntries(players.map((p) => [p.uid, p.wallet]));
    const res = applyPayout({
      wallets,
      bets,
      winningSlotId,
      winningGuessUid,
      roundIndex: roundIndexNow,
    });

    await batchUpdateWallets(roomIdStr, res.updatedWallets);
    await hostSetPhase(roomIdStr, "PAYOUT", Date.now() + 12_000);

    setTimeout(async () => {
      const nextRound = roundIndexNow + 1;

      if (nextRound >= totalRounds) {
        await hostSetPhase(roomIdStr, "ENDED", null);
        return;
      }

      await updateDoc(roomDoc(roomIdStr), {
        roundIndex: nextRound,
        currentQuestion: null,
        revealed: null,
      });

      await hostSetPhase(roomIdStr, "LOBBY", null);
    }, 600);
  }

  async function saveMyBets() {
    if (!roundId) return;

    const cleaned = myBetsLocal.map((b) => ({
      ...b,
      stake: canBetWithPokerChips ? b.stake : { red: 0, blue: 0, green: 0 },
    }));

    await upsertBets(roomIdStr, roundId, uidStr, cleaned);
  }

  function setMarkerSlot(markerIndex: 0 | 1, slotId: SlotId) {
    setMyBetsLocal((prev) => prev.map((b) => (b.markerIndex === markerIndex ? { ...b, slotId } : b)));
  }

  function setMarkerStake(markerIndex: 0 | 1, stake: { red: number; blue: number; green: number }) {
    setMyBetsLocal((prev) => prev.map((b) => (b.markerIndex === markerIndex ? { ...b, stake } : b)));
  }

  return (
    <div className="roomLayout">
      <div className="mainCol">
        <div className={`phaseBanner intent-${meta.intent}`}>
          <div className="phaseBannerTop">
            <div>
              <div className="phaseTitle">{meta.title}</div>
              <div className="phaseSubtitle">{meta.subtitle}</div>
            </div>

            <div className="phaseBadges">
              <span className="badge">Code: <strong>{roomIdStr}</strong></span>
              <span className="badge">Round: <strong>{room.roundIndex + 1}/{room.settings.totalRounds}</strong></span>
              <span className="badge">Answered: <strong>{answeredCount}/{players.length}</strong></span>
              <span className="badge">Bets: <strong>{betCount}/{players.length}</strong></span>
            </div>
          </div>

          <TimerBar endsAtMs={room.phaseEndsAt ?? null} />
          <Stepper phase={phase} />
        </div>

        <div className="panel">
          <div className="panelHeader">
            <h3>Question</h3>
            {roundQuestion?.unit && <span className="muted">Unit: {roundQuestion.unit}</span>}
          </div>

          {roundQuestion ? (
            <div className="questionText">{roundQuestion.prompt}</div>
          ) : (
            <div className="muted">Waiting for host to choose a question…</div>
          )}
        </div>

        {phase === "LOBBY" && (
          <div className="panel callout">
            <h3>Ready?</h3>
            <div className="muted">Host starts when everyone is in.</div>
            <div className="ctaRow">
              <button className="primary" disabled={!isHost || players.length < 3} onClick={hostStartRound}>
                Start round
              </button>
              {!isHost && <span className="muted">Waiting for host…</span>}
            </div>
            {isHost && players.length < 3 && <div className="muted small">Need at least 3 players (bots will fill if solo).</div>}
          </div>
        )}

        {phase === "QUESTION" && (
          <div className="panel callout">
            <h3>Think of a number</h3>
            <div className="muted">You’ll submit privately when the timer advances.</div>
          </div>
        )}

        {phase === "ANSWERING" && (
          <div className="panel callout">
            <h3>Submit your answer</h3>
            <div className="ctaRow">
              <input
                type="number"
                value={answerValue}
                onChange={(e) => setAnswerValue(Number(e.target.value))}
                className="answerInput"
              />
              <button
                className="primary"
                disabled={!roundId}
                onClick={async () => {
                  if (!roundId) return;
                  await submitAnswer(roomIdStr, roundId, uidStr, answerValue);
                }}
              >
                Submit
              </button>

              {myAnswer != null && (
                <span className="statusPill ok">
                  Submitted: <strong>{myAnswer}</strong>
                </span>
              )}
            </div>

            {isHost && (
              <div className="hostRow">
                <button disabled={!allAnswered} onClick={hostArrangeAndBet}>
                  Arrange &amp; start betting
                </button>
                {!allAnswered && <span className="muted small">Waiting for everyone…</span>}
              </div>
            )}
          </div>
        )}

        {phase === "ARRANGE" && (
          <div className="panel callout">
            <h3>Arranging answers…</h3>
            <div className="muted">Answers are being placed onto the mat.</div>
          </div>
        )}

        {phase === "BETTING" && (
          <div className="panel callout">
            <div className="panelHeader">
              <h3>Place your bets</h3>
              <span className="muted small">
                Two markers. {canBetWithPokerChips ? "Poker chips enabled." : "Round 1: markers only."}
              </span>
            </div>

            <div className="ctaRow">
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <span className="muted small">Active marker:</span>
                <button onClick={() => setSelectedMarkerIndex(0)} className={selectedMarkerIndex === 0 ? "primary" : ""}>
                  Marker 1
                </button>
                <button onClick={() => setSelectedMarkerIndex(1)} className={selectedMarkerIndex === 1 ? "primary" : ""}>
                  Marker 2
                </button>
                <button onClick={saveMyBets} className={myBetsSaved ? "good" : ""}>
                  {myBetsSaved ? "Bets saved ✓" : "Save bets"}
                </button>
              </div>

              {isHost && (
                <button className="primary" onClick={hostRevealAndPayout} disabled={!correctAnswer}>
                  Reveal &amp; payout
                </button>
              )}
            </div>

            {me && (
              <div className="betEditorGrid">
                {myBetsLocal.map((b) => (
                  <div key={b.markerIndex} className={`miniPanel ${selectedMarkerIndex === b.markerIndex ? "active" : ""}`}>
                    <div className="miniHeader">
                      <strong>Marker {b.markerIndex + 1}</strong>
                      <span className="muted small">Slot: {b.slotId}</span>
                    </div>
                    <ChipSelector
                      wallet={me.wallet}
                      value={b.stake}
                      onChange={(stake) => setMarkerStake(b.markerIndex, stake)}
                      disabled={!canBetWithPokerChips}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(phase === "ARRANGE" || phase === "BETTING" || phase === "REVEAL" || phase === "PAYOUT" || phase === "ENDED") && (
          <div className="panel">
            <div className="panelHeader">
              <h3>Betting Mat</h3>
              <span className="muted small">{phase === "BETTING" ? "Tap a slot to place marker" : "Preview"}</span>
            </div>

            <div className={`matWrap ${phase !== "BETTING" ? "disabled" : ""}`}>
              <BettingMat
                arrangement={arrangement}
                bets={bets}
                players={players}
                meUid={uidStr}
                selectedMarkerIndex={selectedMarkerIndex}
                onPickSlot={phase === "BETTING" ? setMarkerSlot : undefined}
                winningSlotId={(room.revealed?.winningSlotId as SlotId | null) ?? null}
              />
              {phase !== "BETTING" && <div className="matOverlay">Betting opens in the BETTING phase</div>}
            </div>
          </div>
        )}

        {(phase === "REVEAL" || phase === "PAYOUT" || phase === "ENDED") && (
          <div className="panel callout">
            <h3>{phase === "REVEAL" ? "Reveal" : phase === "PAYOUT" ? "Payout" : "Game Over"}</h3>
            {room.revealed ? (
              <>
                <div className="bigNumber">Correct: {room.revealed.correctAnswer}</div>
                <div className="muted">
                  Winning slot: <strong>{room.revealed.winningSlotId ?? "—"}</strong>
                </div>
              </>
            ) : (
              <div className="muted">Waiting for host…</div>
            )}
          </div>
        )}
      </div>

      <div className="sideCol">
        <div className="panel">
          <div className="panelHeader">
            <h3>Players</h3>
            <span className="muted small">{players.length}/{room.settings.maxPlayers}</span>
          </div>

          <div className="playerList">
            {players.map((p) => (
              <div key={p.uid} className={`playerRow ${p.uid === uidStr ? "me" : ""}`}>
                <div className="playerName">
                  {p.uid === room.hostUid ? "👑 " : ""}
                  {p.isBot ? "🤖 " : ""}
                  {p.name}
                </div>
                <div className="playerPts">{walletToPoints(p.wallet)} pts</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Your profile</h3>
          <div className="ctaRow">
            <input value={myName} onChange={(e) => setMyName(e.target.value)} />
            <button
              onClick={async () => {
                localStorage.setItem(LS_NAME, myName);
                const { upsertPlayer } = await import("../services/roomApi");
                await upsertPlayer(roomIdStr, uidStr, myName.trim() || "Player");
              }}
            >
              Update
            </button>
          </div>

          <div className="statusStack">
            <span className={`statusPill ${myAnswer != null ? "ok" : ""}`}>
              {myAnswer != null ? "Answer submitted ✓" : "No answer yet"}
            </span>
            <span className={`statusPill ${myBetsSaved ? "ok" : ""}`}>
              {myBetsSaved ? "Bets saved ✓" : "No bets saved"}
            </span>
          </div>
        </div>

        <div className="panel">
          <h3 style={{ marginTop: 0 }}>How to play</h3>
          <ol className="muted small" style={{ marginTop: 0, paddingLeft: 18 }}>
            <li>Answer a numeric question.</li>
            <li>Answers sort onto the mat.</li>
            <li>Place two markers; add chips from Round 2+.</li>
            <li>Closest without going over wins (or “All too high”).</li>
          </ol>
        </div>
      </div>
    </div>
  );
}