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
    <div className="row">
      <span className="pill">Stake</span>
      <label className="row" style={{ gap: 6 }}>
        <span className="chip">red</span>
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
        <span className="chip">blue</span>
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
        <span className="chip">green</span>
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
  );
}
