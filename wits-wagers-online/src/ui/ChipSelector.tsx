import React from "react";
import { BetStake, ChipWallet } from "../game/types";

function clamp(n: number) {
  return Math.max(0, Math.min(999, n));
}

export function ChipSelector(props: {
  wallet: ChipWallet;
  value: BetStake;
  onChange: (v: BetStake) => void;
  disabled?: boolean;
}) {
  const { wallet, value, onChange, disabled } = props;

  const set = (key: keyof BetStake, n: number) => {
    onChange({ ...value, [key]: clamp(n) });
  };

  return (
    <div style={{ width: "100%" }}>
      <div className="stakeLegend">
        <span className="chip red">Red</span> = 1 pt
        <span className="chip blue">Blue</span> = 5 pts
        <span className="chip green">Green</span> = 25 pts
        <span className="youHave">
          You have:
          <span className="chip red">
            <span className="chipCount">{wallet.red}</span>
          </span>
          <span className="chip blue">
            <span className="chipCount">{wallet.blue}</span>
          </span>
          <span className="chip green">
            <span className="chipCount">{wallet.green}</span>
          </span>
        </span>
      </div>
      <div className="row">
        <span className="pill">Stake</span>
        <label className="row" style={{ gap: 6 }}>
          <span className="chip red">red</span>
          <input
            disabled={disabled}
            type="number"
            min={0}
            max={wallet.red}
            value={value.red}
            onChange={(e) => set("red", Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
        <label className="row" style={{ gap: 6 }}>
          <span className="chip blue">blue</span>
          <input
            disabled={disabled}
            type="number"
            min={0}
            max={wallet.blue}
            value={value.blue}
            onChange={(e) => set("blue", Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>
        <label className="row" style={{ gap: 6 }}>
          <span className="chip green">green</span>
          <input
            disabled={disabled}
            type="number"
            min={0}
            max={wallet.green}
            value={value.green}
            onChange={(e) => set("green", Number(e.target.value))}
            style={{ width: 90 }}
          />
        </label>
        <span className="muted" style={{ fontSize: 12 }}>
          (marker adds +1 automatically)
        </span>
      </div>
    </div>
  );
}
