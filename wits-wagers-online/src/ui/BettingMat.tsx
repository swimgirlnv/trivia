import { useMemo } from "react";
import { TbPokerChip } from "react-icons/tb";
import type { Arrangement, BetDoc, Player, SlotId, BetMarker } from "../game/types";
import { SLOT_ODDS, SLOT_ORDER, getPlayerColorMap, initials } from "../game/types";

function slotOddsLabel(slotId: SlotId) {
  const odds = SLOT_ODDS[slotId];
  return `${odds}:1`;
}

function stakeTotal(s: { red: number; blue: number; green: number }) {
  return (s?.red ?? 0) + (s?.blue ?? 0) + (s?.green ?? 0);
}

type MarkerTag = {
  uid: string;
  markerIndex: 0 | 1;
  slotId: SlotId;
  stake: { red: number; blue: number; green: number };
};

export function BettingMat(props: {
  arrangement: Arrangement;
  bets: BetDoc[];
  players: Player[];
  meUid: string;
  onPickSlot?: (markerIndex: 0 | 1, slotId: SlotId) => void;
  selectedMarkerIndex?: 0 | 1;
  winningSlotId?: SlotId | null;
  myBetsLocal?: BetMarker[];
  isBettingPhase?: boolean;
}) {
  const { arrangement, bets, players, meUid, onPickSlot, selectedMarkerIndex, winningSlotId, myBetsLocal, isBettingPhase } = props;

  const uidToName = useMemo(
    () => Object.fromEntries(players.map((p) => [p.uid, p.name])),
    [players]
  );

  const uidToColor = useMemo(() => getPlayerColorMap(players), [players]);

  const allMarkers: MarkerTag[] = useMemo(() => {
    const out: MarkerTag[] = [];
    for (const b of bets) {
      for (const m of (b.bets ?? []) as BetMarker[]) {
        out.push({
          uid: b.uid,
          markerIndex: m.markerIndex,
          slotId: m.slotId,
          stake: m.stake ?? { red: 0, blue: 0, green: 0 },
        });
      }
    }
    return out;
  }, [bets]);

  // Add local marker preview for current user during betting phase
  const previewMarkers: MarkerTag[] = useMemo(() => {
    if (!isBettingPhase || !myBetsLocal) return [];
    return myBetsLocal.map((b) => ({
      uid: meUid,
      markerIndex: b.markerIndex,
      slotId: b.slotId,
      stake: b.stake,
    }));
  }, [isBettingPhase, myBetsLocal, meUid]);

  // Merge preview markers with actual markers for display
  const allMarkersWithPreview: MarkerTag[] = useMemo(() => {
    if (!isBettingPhase || !myBetsLocal) return allMarkers;
    // Remove my server markers, add local preview
    return [
      ...allMarkers.filter((m) => m.uid !== meUid),
      ...previewMarkers,
    ];
  }, [allMarkers, previewMarkers, isBettingPhase, myBetsLocal, meUid]);

  const markersBySlot: Record<string, MarkerTag[]> = useMemo(() => {
    const map: Record<string, MarkerTag[]> = {};
    for (const m of allMarkersWithPreview) (map[m.slotId] ??= []).push(m);
    return map;
  }, [allMarkersWithPreview]);

  const myMarkers = useMemo(() => allMarkers.filter((m) => m.uid === meUid), [allMarkers, meUid]);

  const myMarkerSlot = useMemo(() => {
    const m: Partial<Record<0 | 1, SlotId>> = {};
    for (const mm of myMarkers) m[mm.markerIndex] = mm.slotId;
    return m;
  }, [myMarkers]);

  return (
    <div className="matWrap" aria-label="Betting mat">
      <div className="mat">
        {SLOT_ORDER.map((slotId) => {
          const slot = arrangement.slots[slotId];
          const isWin = winningSlotId === slotId;

          const isClickable = !!onPickSlot;
          const isMySlot =
            myMarkers.some((m) => m.slotId === slotId) ||
            (selectedMarkerIndex != null && myMarkerSlot[selectedMarkerIndex] === slotId);

          const slotClass =
            "slot" +
            (isClickable ? " clickable" : " locked") +
            (isWin ? " win" : "") +
            (isMySlot ? " mine" : "");

          return (
            <div
              key={slotId}
              data-slot={slotId}
              className={slotClass}
              style={{ gridColumn: slotId === "ALL_TOO_HIGH" ? "span 2" : "span 1" }}
              onClick={() => {
                if (!onPickSlot || selectedMarkerIndex == null) return;
                onPickSlot(selectedMarkerIndex, slotId);
              }}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={(e) => {
                if (!onPickSlot || selectedMarkerIndex == null) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPickSlot(selectedMarkerIndex, slotId);
                }
              }}
            >
              <div className="slotHeader">
                <div className="slotHeaderLeft">
                  <div className="slotTitle">{slotId === "ALL_TOO_HIGH" ? "All too high" : "Payout"}</div>
                  <div className="slotSub">
                    {slotId === "ALL_TOO_HIGH" ? "Closest overall wins" : "Odds for this slot"}
                  </div>
                </div>
                <div className="slotBadge">{slotOddsLabel(slotId)}</div>
              </div>

              <div className="slotBody">
                {slot.answers.length === 0 ? (
                  <div className="emptyHint">—</div>
                ) : (
                  slot.answers.map((a) => (
                    <div className="answerCard" key={`${a.uid}:${a.value}`}>
                      <strong>{a.value}</strong>
                      <span>{uidToName[a.uid] ?? a.uid.slice(0, 6)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="slotFooter">
                <div className="markerRow">
                  {(markersBySlot[slotId] ?? []).map((m) => {
                    const isMe = m.uid === meUid;
                    const isActive = isMe && selectedMarkerIndex != null && m.markerIndex === selectedMarkerIndex;

                    const name = uidToName[m.uid] ?? m.uid.slice(0, 6);
                    const total = stakeTotal(m.stake);
                    const chipColor = uidToColor[m.uid] ?? "#4CC9F0";

                    // Calculate chip breakdown for display
                    const stakeArr = [
                      { color: "red", count: m.stake.red, value: 1 },
                      { color: "blue", count: m.stake.blue, value: 5 },
                      { color: "green", count: m.stake.green, value: 25 },
                    ];
                    const totalPoints = m.stake.red + m.stake.blue * 5 + m.stake.green * 25;

                    return (
                      <div
                        key={`${m.uid}:${m.markerIndex}:${m.slotId}`}
                        className={"betChip" + (isMe ? " me" : "") + (isActive ? " active" : "")}
                        style={{ ["--chipColor" as any]: chipColor }}
                        title={`${name} · marker ${m.markerIndex + 1}${total ? ` · +${total} chips` : ""}`}
                      >
                        <TbPokerChip className="betChipIcon" />
                        <span className="betChipInitials">{initials(name)}</span>
                        <span className="betChipNum">{m.markerIndex + 1}</span>
                        {/* Notification dots for each chip color */}
                        <span className="betChipDot">
                          {stakeArr.filter(s => s.count > 0).map(s => (
                            <span key={s.color} className={`dot ${s.color}`}>{s.count}</span>
                          ))}
                        </span>
                        {/* Total points below marker */}
                        {totalPoints > 0 && (
                          <span className="betChipTotal">{totalPoints} pts</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isWin && <div className="winPill">Winning slot ✓</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}