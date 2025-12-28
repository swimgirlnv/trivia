import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ensureAnonAuth } from "../services/auth";
import { canJoinRoom, createRoom, upsertPlayer } from "../services/roomApi";

const LS_NAME = "ww:name";

export function HomePage() {
  const nav = useNavigate();
  const [name, setName] = useState(() => localStorage.getItem(LS_NAME) ?? "");
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    localStorage.setItem(LS_NAME, name);
  }, [name]);

  const canContinue = useMemo(() => name.trim().length > 0, [name]);

  return (
    <div className="grid2">
      <div className="card">
        <h2>Create a room</h2>
        <p className="muted">
          Start a game, share the room code, and invite up to 9 friends.
        </p>
        <div className="row">
          <input
            value={name}
            placeholder="Your name"
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <button
            className="primary"
            disabled={!canContinue}
            onClick={async () => {
              const user = await ensureAnonAuth();
              const id = await createRoom({ hostUid: user.uid, hostName: name.trim() });
              nav(`/room/${id}`);
            }}
          >
            Create
          </button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Tip: You can rename yourself later in the lobby.
        </div>
      </div>

      <div className="card">
        <h2>Join a room</h2>
        <p className="muted">Paste the room code your friend sends you.</p>
        <div className="row">
          <input
            value={roomCode}
            placeholder="Room code"
            onChange={(e) => setRoomCode(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <button
            disabled={!canContinue || roomCode.trim().length < 6}
            onClick={async () => {
              const code = roomCode.trim();
              const user = await ensureAnonAuth();
              const check = await canJoinRoom(code);
              if (!check.ok) {
                alert(check.reason);
                return;
              }
              await upsertPlayer(code, user.uid, name.trim());
              nav(`/room/${code}`);
            }}
          >
            Join
          </button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Works best if the host creates the room first.
        </div>
      </div>
    </div>
  );
}
