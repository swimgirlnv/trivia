import { useMemo } from "react";
import { TbPokerChip } from "react-icons/tb";
import { Arrangement, BetDoc, Player, SlotId, SLOT_ODDS, SLOT_ORDER, BetMarker } from "../game/types";

function slotOddsLabel(slotId: SlotId) {
  const odds = SLOT_ODDS[slotId];
  return `${odds}:1`;
}

function initials(name: string) {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

// Deterministic color from uid (stable across refresh)
function colorForUid(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  // vivid but readable on dark bg
  return `hsl(${hue} 85% 62%)`;
}

type MarkerTag = {
  uid: string;
  markerIndex: 0 | 1;
  slotId: SlotId;
  stake: { red: number; blue: number; green: number };
};

function stakeTotal(s: { red: number; blue: number; green: number }) {
  return (s?.red ?? 0) + (s?.blue ?? 0) + (s?.green ?? 0);
}

export function BettingMat(props: {
  arrangement: Arrangement;
  bets: BetDoc[];
  players: Player[];
  meUid: string;
  onPickSlot?: (markerIndex: 0 | 1, slotId: SlotId) => void;
  selectedMarkerIndex?: 0 | 1;
  winningSlotId?: SlotId | null;
}) {
  const { arrangement, bets, players, meUid, onPickSlot, selectedMarkerIndex, winningSlotId } = props;

  const uidToName = useMemo(() => Object.fromEntries(players.map((p) => [p.uid, p.name])), [players]);

  const uidToColor = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of players) m[p.uid] = colorForUid(p.uid);
    return m;
  }, [players]);

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

  const markersBySlot: Record<string, MarkerTag[]> = useMemo(() => {
    const map: Record<string, MarkerTag[]> = {};
    for (const m of allMarkers) {
      (map[m.slotId] ??= []).push(m);
    }
    return map;
  }, [allMarkers]);

  const myMarkers = useMemo(() => allMarkers.filter((m) => m.uid === meUid), [allMarkers, meUid]);

  const myMarkerSlot = useMemo(() => {
    const m: Partial<Record<0 | 1, SlotId>> = {};
    for (const mm of myMarkers) m[mm.markerIndex] = mm.slotId;
    return m;
  }, [myMarkers]);

  return (
    <div className="matWrap">
      <div className="matScroll" aria-label="Betting mat">
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
                    <div className="slotSub">{slotId === "ALL_TOO_HIGH" ? "Closest overall wins" : "Odds for this slot"}</div>
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
                      const chipColor = uidToColor[m.uid] ?? "hsl(200 80% 60%)";

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
                          {total > 0 && <span className="betChipExtra">+{total}</span>}
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
    </div>
  );
}