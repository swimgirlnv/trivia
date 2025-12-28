import { BetStake, ChipWallet } from "./types";

export function walletToPoints(w: ChipWallet): number {
  return w.green * 25 + w.blue * 5 + w.red;
}

export function pointsToWallet(points: number): ChipWallet {
  const green = Math.floor(points / 25);
  points -= green * 25;
  const blue = Math.floor(points / 5);
  points -= blue * 5;
  const red = points;
  return { red, blue, green };
}

export function addWallet(a: ChipWallet, b: ChipWallet): ChipWallet {
  return { red: a.red + b.red, blue: a.blue + b.blue, green: a.green + b.green };
}

export function subWallet(a: ChipWallet, b: ChipWallet): ChipWallet {
  return { red: a.red - b.red, blue: a.blue - b.blue, green: a.green - b.green };
}

export function clampNonNegative(w: ChipWallet): ChipWallet {
  return { red: Math.max(0, w.red), blue: Math.max(0, w.blue), green: Math.max(0, w.green) };
}

export function stakeToPoints(stake: BetStake): number {
  return stake.green * 25 + stake.blue * 5 + stake.red;
}

export function emptyStake(): BetStake {
  return { red: 0, blue: 0, green: 0 };
}
