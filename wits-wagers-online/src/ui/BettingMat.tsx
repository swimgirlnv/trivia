import { Arrangement, BetDoc, Player, SlotId, SLOT_ODDS, SLOT_ORDER } from "../game/types";

function slotLabel(slotId: SlotId) {
  if (slotId === "ALL_TOO_HIGH") return "All too high";
  const odds = SLOT_ODDS[slotId];
  return `${odds}:1`;
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

  const uidToName = Object.fromEntries(players.map((p) => [p.uid, p.name]));

  const markersBySlot: Record<string, string[]> = {};
  for (const b of bets) {
    for (const m of b.bets ?? []) {
      const key = m.slotId;
      markersBySlot[key] = markersBySlot[key] ?? [];
      markersBySlot[key].push(`${b.uid}:${m.markerIndex}`);
    }
  }

  return (
    <div className="card">
      <h3>Betting Mat</h3>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        Click a slot to place your selected marker.
      </div>

      <div className="mat">
        {SLOT_ORDER.map((slotId) => {
          const slot = arrangement.slots[slotId];
          const isWin = winningSlotId === slotId;
          return (
            <div
              key={slotId}
              className="slot"
              style={{
                borderStyle: isWin ? "solid" : "dashed",
                borderColor: isWin ? "rgba(61,220,151,0.6)" : undefined,
                background: isWin ? "rgba(61,220,151,0.08)" : undefined,
                gridColumn: slotId === "ALL_TOO_HIGH" ? "span 2" : "span 1",
              }}
              onClick={() => {
                if (!onPickSlot || selectedMarkerIndex == null) return;
                onPickSlot(selectedMarkerIndex, slotId);
              }}
              role={onPickSlot ? "button" : undefined}
              tabIndex={0}
            >
              <div className="slotHeader">
                <span style={{ fontWeight: 600 }}>
                  {slotId === "ALL_TOO_HIGH" ? "All guesses too high" : "Payout"}
                </span>
                <span className="badge">{slotLabel(slotId)}</span>
              </div>

              {slot.answers.map((a) => (
                <div className="answerCard" key={`${a.uid}:${a.value}`}>
                  <strong>{a.value}</strong>
                  <span>{uidToName[a.uid] ?? a.uid.slice(0, 6)}</span>
                </div>
              ))}

              <div className="markerRow">
                {(markersBySlot[slotId] ?? []).map((tag) => {
                  const [uid, idx] = tag.split(":");
                  const isMe = uid === meUid;
                  return (
                    <div
                      key={tag}
                      className={"marker" + (isMe ? " me" : "")}
                      title={`${uidToName[uid] ?? uid} · marker ${Number(idx) + 1}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
