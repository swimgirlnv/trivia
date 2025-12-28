import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { RoomPage } from "./pages/RoomPage";

export function App() {
  return (
    <HashRouter>
      <div className="container">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Wits &amp; Wagers Online</h1>
          <span className="badge">Max 10 players · realtime</span>
        </div>

        <div className="spacer" />

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <div className="spacer" />
        <div className="muted" style={{ fontSize: 12 }}>
          Built for GitHub Pages + Firebase (Firestore). This is a fan-made project inspired by the board game.
        </div>
      </div>
    </HashRouter>
  );
}
