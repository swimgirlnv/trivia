import { useEffect, useMemo, useState } from "react";
import "./RoomPage.css";
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
import { QUESTIONS, getShuffledQuestions } from "../game/questions";
import { arrangeAnswers } from "../game/arrange";
import { computeWinning } from "../game/winner";
import { applyPayout } from "../game/payout";
import { emptyStake, walletToPoints } from "../game/chips";
import { BettingMat } from "../ui/BettingMat";
import { ChipSelector } from "../ui/ChipSelector";
import { TimerBar } from "../ui/TimerBar";
import type { Player, Room } from "../game/types";
import { BetMarker, SlotId } from "../game/types";
import { ensureSoloBots, runBotsAnswering, runBotsBetting } from "../bots/botEngine";
import { upsertBotPlayer } from "../services/roomApi";
import { BotIcon } from "../bots/botNames";

const LS_NAME = "ww:name";

/** Deterministic color from uid (stable across refresh) */
function colorForUid(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 85% 62%)`;
}

function getUidToColor(players: Player[]) {
  const m: Record<string, string> = {};
  for (const p of players) m[p.uid] = colorForUid(p.uid);
  return m;
}

export function RoomPage() {
  const { roomId } = useParams();

  // Track used question IDs for this session
  const [usedQuestionIds, setUsedQuestionIds] = useState<string[]>([]);
  const [shuffledQuestions, setShuffledQuestions] = useState(() => getShuffledQuestions());

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

  const uidToColor = useMemo(() => getUidToColor(players), [players]);

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

  useEffect(() => onAuth((u) => setUid(u?.uid ?? null)), []);

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
  }, [roomId, room, setRoundId, setAnswers, setBets]);

  // Persist local name
  useEffect(() => localStorage.setItem(LS_NAME, myName), [myName]);

  const me = useMemo(() => players.find((p) => p.uid === uid) ?? null, [players, uid]);
  const isHost = useMemo(() => !!(room && uid && room.hostUid === uid), [room, uid]);

  // Solo bots
  useEffect(() => {
    if (!roomId || !room || !isHost) return;
    if (room.phase !== "LOBBY") return;
    ensureSoloBots({ roomId, players, upsertBotPlayer }).catch(console.error);
  }, [roomId, room, isHost, players]);

  const arrangement = useMemo(() => arrangeAnswers(answers), [answers]);

  const myAnswer = useMemo(() => answers.find((a) => a.uid === uid)?.value ?? null, [answers, uid]);
  const myBetDoc = useMemo(() => bets.find((b) => b.uid === uid) ?? null, [bets, uid]);

  // Keep local bets synced to server
  useEffect(() => {
    if (!myBetDoc) return;
    if ((myBetDoc.bets?.length ?? 0) > 0) setMyBetsLocal(myBetDoc.bets as any);
  }, [myBetDoc?.updatedAt, myBetDoc]);

  const roundQuestion = useMemo(() => room?.currentQuestion ?? null, [room?.currentQuestion]);
  const correctAnswer = useMemo(() => {
    if (!roundQuestion) return null;
    const q = QUESTIONS.find((x) => x.id === roundQuestion.id);
    return q?.answer ?? null;
  }, [roundQuestion]);

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

  // Early returns
  if (!roomId) return <div className="card">Missing room id.</div>;
  if (!room) return <div className="card">Loading room…</div>;
  if (!uid) return <div className="card">Authenticating…</div>;

  const roomIdStr = roomId;
  const uidStr = uid;

  const phase = room.phase;
  const meta = PHASE_META[phase] ?? { title: phase, subtitle: "", intent: "idle" as const };

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
    // Find the first unused question
    const nextQ = shuffledQuestions.find((q) => !usedQuestionIds.includes(q.id));
    if (!nextQ) {
      // All questions used, reshuffle and reset
      const reshuffled = getShuffledQuestions();
      setShuffledQuestions(reshuffled);
      setUsedQuestionIds([]);
      // Use the first question of the reshuffle
      await hostSetQuestion(roomIdStr, { id: reshuffled[0].id, prompt: reshuffled[0].prompt, unit: reshuffled[0].unit });
      setUsedQuestionIds([reshuffled[0].id]);
    } else {
      await hostSetQuestion(roomIdStr, { id: nextQ.id, prompt: nextQ.prompt, unit: nextQ.unit });
      setUsedQuestionIds([...usedQuestionIds, nextQ.id]);
    }
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
    if (!correctAnswer) return;

    const roundIndexNow = room.roundIndex;
    const totalRounds = room.settings.totalRounds;

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

  const showMat = phase === "ARRANGE" || phase === "BETTING" || phase === "REVEAL" || phase === "PAYOUT" || phase === "ENDED";

  return (
    <div className="fullWidthRoom">
      <div className="roomLayout">
        {/* MAIN (span full width so it doesn't feel cramped) */}
        <div className="mainCol" style={{ gridColumn: "1 / -1" }}>
          <div className={`phaseBanner intent-${meta.intent}`}>
            <div className="phaseBannerTop">
              <div>
                <div className="phaseTitle">{meta.title}</div>
                <div className="phaseSubtitle">{meta.subtitle}</div>
              </div>

              <div className="phaseBadges">
                <span className="badge">
                  Code: <strong>{roomIdStr}</strong>
                </span>
                <span className="badge">
                  Round:{" "}
                  <strong>
                    {room.roundIndex + 1}/{room.settings.totalRounds}
                  </strong>
                </span>
                <span className="badge">
                  Answered:{" "}
                  <strong>
                    {answeredCount}/{players.length}
                  </strong>
                </span>
                <span className="badge">
                  Bets:{" "}
                  <strong>
                    {betCount}/{players.length}
                  </strong>
                </span>
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

            {roundQuestion ? <div className="questionText">{roundQuestion.prompt}</div> : <div className="muted">Waiting…</div>}
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

        {/* FULL-WIDTH MAT ROW */}
        {showMat && (
          <div style={{ gridColumn: "1 / -1" }}>
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
                  myBetsLocal={phase === "BETTING" ? myBetsLocal : undefined}
                  isBettingPhase={phase === "BETTING"}
                />
                {phase !== "BETTING" && <div className="matOverlay">Betting opens in the BETTING phase</div>}
              </div>
            </div>
          </div>
        )}

        <DrawerSideCol
          players={players}
          room={room}
          uidStr={uidStr}
          myName={myName}
          setMyName={setMyName}
          myAnswer={myAnswer}
          myBetsSaved={myBetsSaved}
          roomIdStr={roomIdStr}
          uidToColor={uidToColor}
        />
      </div>
    </div>
  );
}

type DrawerSideColProps = {
  players: Player[];
  room: Room;
  uidStr: string;
  myName: string;
  setMyName: React.Dispatch<React.SetStateAction<string>>;
  myAnswer: number | null;
  myBetsSaved: boolean;
  roomIdStr: string;
  uidToColor: Record<string, string>;
};

function DrawerSideCol({
  players,
  room,
  uidStr,
  myName,
  setMyName,
  myAnswer,
  myBetsSaved,
  roomIdStr,
  uidToColor,
}: DrawerSideColProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open && (
        <button className="drawerFab" onClick={() => setOpen(true)} title="Open info drawer" aria-label="Open info drawer">
          <span role="img" aria-label="Open">
            ℹ️
          </span>
        </button>
      )}

      <div className={`sideColDrawer${open ? " open" : ""}`} style={{ display: open ? undefined : "none" }}>
        <button className="drawerFab drawerFabClose" onClick={() => setOpen(false)} title="Close info drawer" aria-label="Close info drawer">
          <span role="img" aria-label="Close">
            ✖️
          </span>
        </button>

        <div className="drawerContent">
          <div className="panel smallPanel">
            <h3 style={{ marginTop: 0, fontSize: 18 }}>How to play</h3>
            <ol className="muted small" style={{ marginTop: 0, paddingLeft: 18 }}>
              <li>Answer a numeric question.</li>
              <li>Answers sort onto the mat.</li>
              <li>Place two markers; add chips from Round 2+.</li>
              <li>Closest without going over wins (or “All too high”).</li>
            </ol>
          </div>

          <div className="panel smallPanel">
            <div className="panelHeader">
              <h3 style={{ fontSize: 18 }}>Players</h3>
              <span className="muted small">
                {players.length}/{room.settings.maxPlayers}
              </span>
            </div>

            <div className="playerList">
              {players.map((p) => (
                <div key={p.uid} className={`playerRow ${p.uid === uidStr ? "me" : ""}`} style={{ fontSize: 14, padding: "8px 10px" }}>
                  <div className="playerName">
                    {p.uid === room.hostUid ? "👑 " : ""}
                    {p.isBot ? <BotIcon /> : null}
                    <span className="colorDot" style={{ ["--dot" as any]: uidToColor[p.uid] }} />
                    {p.name}
                  </div>
                  <div className="playerPts">{walletToPoints(p.wallet)} pts</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel smallPanel">
            <h3 style={{ marginTop: 0, fontSize: 18 }}>Your profile</h3>
            <div className="ctaRow">
              <input value={myName} onChange={(e) => setMyName(e.target.value)} style={{ fontSize: 14, height: 28 }} />
              <button
                style={{ fontSize: 14, height: 28 }}
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
              <span className={`statusPill ${myAnswer != null ? "ok" : ""}`} style={{ fontSize: 13 }}>
                {myAnswer != null ? "Answer submitted ✓" : "No answer yet"}
              </span>
              <span className={`statusPill ${myBetsSaved ? "ok" : ""}`} style={{ fontSize: 13 }}>
                {myBetsSaved ? "Bets saved ✓" : "No bets saved"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}