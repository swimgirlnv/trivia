import { useEffect, useMemo, useState } from "react";

export function TimerBar(props: { endsAtMs: number | null | undefined; nowMs?: number }) {
  const { endsAtMs } = props;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const { pct, secondsLeft } = useMemo(() => {
    if (!endsAtMs) return { pct: 0, secondsLeft: null as number | null };
    const left = Math.max(0, endsAtMs - now);
    const secondsLeft = Math.ceil(left / 1000);
    // assume phases are ~30-60s; use 60s window for a smooth bar
    const windowMs = 60_000;
    const pct = Math.max(0, Math.min(100, (left / windowMs) * 100));
    return { pct, secondsLeft };
  }, [endsAtMs, now]);

  return (
    <div>
      <div className="timer">
        <div style={{ width: `${pct}%` }} />
      </div>
      {secondsLeft != null && <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>⏳ {secondsLeft}s</div>}
    </div>
  );
}
