import { BetDoc, ChipWallet, SLOT_ODDS, SlotId } from "./types";
import { addWallet, clampNonNegative, pointsToWallet, stakeToPoints, subWallet, walletToPoints } from "./chips";

type PlayerWallets = Record<string, ChipWallet>;

export type PayoutResult = {
  updatedWallets: PlayerWallets;
  // for UI
  perPlayerDeltaPoints: Record<string, number>;
};

/**
 * Applies Wits & Wagers style payouts.
 *
 * Key rule: the cardboard betting marker itself counts as 1 point stake (and cannot be lost).
 * Poker chips (red=1, blue=5, green=25) can be added from round 2 onwards and are lost if wrong.
 */
export function applyPayout(params: {
  wallets: PlayerWallets;
  bets: BetDoc[];
  winningSlotId: SlotId;
  winningGuessUid: string | null;
  roundIndex: number; // 0-based
}): PayoutResult {
  const { wallets, bets, winningSlotId, winningGuessUid, roundIndex } = params;
  const updatedWallets: PlayerWallets = structuredClone(wallets);
  const perPlayerDeltaPoints: Record<string, number> = {};

  // Helper: ensure delta tracking
  const addDelta = (uid: string, delta: number) => {
    perPlayerDeltaPoints[uid] = (perPlayerDeltaPoints[uid] ?? 0) + delta;
  };

  // Round 1: no poker chips can be bet; ignore stakes for fairness
  const canUsePokerChips = roundIndex >= 1;

  // First, "take" staked poker chips into escrow (remove from wallet) for all bets (losers lose them).
  // Winners will get stake returned + winnings.
  const escrowByPlayer: Record<string, ChipWallet> = {};

  for (const b of bets) {
    const uid = b.uid;
    const w = updatedWallets[uid] ?? { red: 0, blue: 0, green: 0 };
    if (!canUsePokerChips) {
      escrowByPlayer[uid] = { red: 0, blue: 0, green: 0 };
      continue;
    }

    // sum stake across markers
    const sum = { red: 0, blue: 0, green: 0 };
    for (const m of b.bets.slice(0, 2)) {
      sum.red += m.stake.red;
      sum.blue += m.stake.blue;
      sum.green += m.stake.green;
    }

    // clamp to available wallet (prevent overbet)
    const clamped = {
      red: Math.min(sum.red, w.red),
      blue: Math.min(sum.blue, w.blue),
      green: Math.min(sum.green, w.green),
    };

    updatedWallets[uid] = clampNonNegative(subWallet(w, clamped));
    escrowByPlayer[uid] = clamped;
    addDelta(uid, -walletToPoints(clamped));
  }

  const odds = SLOT_ODDS[winningSlotId];

  // Now pay out for each player's markers that are on the winning slot.
  for (const b of bets) {
    const uid = b.uid;
    const markers = b.bets.slice(0, 2);

    // Determine how much of escrow belongs to each marker, in order.
    // We do a simple sequential allocation from the player's escrow.
    let remainingEscrow = structuredClone(escrowByPlayer[uid] ?? { red: 0, blue: 0, green: 0 });

    const takeForMarker = (stake: { red: number; blue: number; green: number }) => {
      const taken = {
        red: Math.min(stake.red, remainingEscrow.red),
        blue: Math.min(stake.blue, remainingEscrow.blue),
        green: Math.min(stake.green, remainingEscrow.green),
      };
      remainingEscrow = clampNonNegative(subWallet(remainingEscrow, taken));
      return taken;
    };

    for (const m of markers) {
      const pokerStake = canUsePokerChips ? takeForMarker(m.stake) : { red: 0, blue: 0, green: 0 };

      const markerBaseStakePoints = 1; // cardboard marker (cannot be lost)
      const pokerStakePoints = stakeToPoints(pokerStake);
      const totalStakePoints = markerBaseStakePoints + pokerStakePoints;

      if (m.slotId !== winningSlotId) {
        // lose poker stake (already removed); marker base is not lost.
        continue;
      }

      // Return poker stake to wallet
      if (canUsePokerChips && pokerStakePoints > 0) {
        updatedWallets[uid] = addWallet(updatedWallets[uid], pokerStake);
        addDelta(uid, pokerStakePoints);
      }

      // Winnings = stakePoints * odds (net gain)
      const winningsPoints = totalStakePoints * odds;
      const winningsWallet = pointsToWallet(winningsPoints);
      updatedWallets[uid] = addWallet(updatedWallets[uid], winningsWallet);
      addDelta(uid, winningsPoints);
    }
  }

  // Bonus: the player who wrote the winning guess gets +3 red chips (3 points).
  if (winningGuessUid) {
    const bonus = { red: 3, blue: 0, green: 0 };
    updatedWallets[winningGuessUid] = addWallet(updatedWallets[winningGuessUid] ?? { red: 0, blue: 0, green: 0 }, bonus);
    addDelta(winningGuessUid, 3);
  }

  return { updatedWallets, perPlayerDeltaPoints };
}
