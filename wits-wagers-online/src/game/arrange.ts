import { Answer, Arrangement, ArrangedSlot, SLOT_ORDER, SlotId } from "./types";

function makeEmptySlot(slotId: SlotId): ArrangedSlot {
  return { slotId, answers: [] };
}

/**
 * Arrange answers onto the betting mat similar to the physical game.
 * - Unique values are sorted low -> high.
 * - Median goes to P2 (2:1) if odd # unique; if even, P2 is left empty and the two middle values go to P3L & P3R.
 * - Duplicates stack in the same slot as their value.
 * - If there are more unique values than slots (excluding ALL_TOO_HIGH), we overflow-stack extremes into the outermost slots.
 */
export function arrangeAnswers(answers: Answer[]): Arrangement {
  const slots: Record<SlotId, ArrangedSlot> = Object.fromEntries(
    SLOT_ORDER.map((id) => [id, makeEmptySlot(id)])
  ) as any;

  // Group duplicates by numeric value
  const byValue = new Map<number, Answer[]>();
  for (const a of answers) {
    const arr = byValue.get(a.value) ?? [];
    arr.push(a);
    byValue.set(a.value, arr);
  }

  const uniqueValues = Array.from(byValue.keys()).sort((a, b) => a - b);

  // Mat slots that actually hold guesses (ALL_TOO_HIGH is separate special bet)
  const guessSlots: SlotId[] = ["P6L", "P5L", "P4L", "P3L", "P2", "P3R", "P4R", "P5R", "P6R"];

  // Determine base placement indices for each unique value
  // We'll place center-out to match odds layout.
  const placements: SlotId[] = [...guessSlots];

  // Standard rule: if even # unique, P2 is empty and the two middle go on P3L and P3R.
  const even = uniqueValues.length % 2 === 0;

  let slotForValue: Record<number, SlotId> = {};

  if (uniqueValues.length === 0) {
    return { slots, uidToSlot: {} };
  }

  if (even) {
    // Remove P2 from available placements; keep it empty.
    const placementsNoP2 = placements.filter((s) => s !== "P2");
    // We have 8 placements around center; if more than 8 unique values, overflow.
    const usable = placementsNoP2;

    // Map sorted values to usable slots left->right (still preserving ordering).
    for (let i = 0; i < uniqueValues.length; i++) {
      const v = uniqueValues[i];
      const idx = Math.min(i, usable.length - 1); // overflow to last slot
      slotForValue[v] = usable[idx];
    }
  } else {
    // Odd count: allow P2
    const usable = placements;
    for (let i = 0; i < uniqueValues.length; i++) {
      const v = uniqueValues[i];
      const idx = Math.min(i, usable.length - 1); // overflow to last slot
      slotForValue[v] = usable[idx];
    }
  }

  // If we overflowed, we want overflow on BOTH extremes, not only the right.
  // Better: reassign when too many unique values to available slots (9 if odd, 8 if even).
  const maxSlots = even ? 8 : 9;
  if (uniqueValues.length > maxSlots) {
    const usable = even
      ? (guessSlots.filter((s) => s !== "P2") as SlotId[])
      : (guessSlots as SlotId[]);
    // Center indices based on usable length
    // We'll map smallest to leftmost, largest to rightmost, and overflow stack into ends.
    // (Simpler: assign in order, but if extra, push into first and last alternating.)
    const base = usable.slice();
    const overflow = uniqueValues.length - base.length;

    // Start with normal mapping for first base.length values.
    const baseValues = uniqueValues.slice(0, base.length);
    for (let i = 0; i < baseValues.length; i++) slotForValue[baseValues[i]] = base[i];

    // Remaining values overflow: alternate adding to leftmost then rightmost ends.
    const remaining = uniqueValues.slice(base.length);
    let toggle = true;
    for (const v of remaining) {
      slotForValue[v] = toggle ? base[0] : base[base.length - 1];
      toggle = !toggle;
    }
  }

  const uidToSlot: Record<string, SlotId> = {};

  // Fill slots with stacked duplicates (and capture uidToSlot)
  for (const v of uniqueValues) {
    const slotId = slotForValue[v];
    const group = (byValue.get(v) ?? []).sort((a, b) => a.uid.localeCompare(b.uid));
    for (const a of group) {
      slots[slotId].answers.push({ uid: a.uid, value: a.value });
      // only first slot mapping per uid
      uidToSlot[a.uid] = slotId;
    }
  }

  return { slots, uidToSlot };
}
