import { describe, expect, it } from "vitest";
import {
  DUPLICATE_AMOUNT_TOLERANCE,
  DUPLICATE_DATE_WINDOW_DAYS,
  DUPLICATE_FLAG_THRESHOLD,
  describeDuplicateReasons,
  findDuplicateCandidates,
  isLikelyDuplicate,
  scoreDuplicate,
  type ExistingTransaction,
  type IncomingTransaction,
} from "../duplicateScore";

const AMOUNT = 500000; // ₦5,000.00 in minor units

function incoming(patch: Partial<IncomingTransaction> = {}): IncomingTransaction {
  return {
    date: "2026-06-10",
    amount: AMOUNT,
    direction: "out",
    description: "POS SHOPRITE LEKKI",
    ...patch,
  };
}

function existing(patch: Partial<ExistingTransaction> = {}): ExistingTransaction {
  return {
    id: "e1",
    date: "2026-06-10",
    amount: AMOUNT,
    type: "expense",
    note: "Shoprite Lekki groceries",
    ...patch,
  };
}

describe("high-confidence duplicates", () => {
  it("flags exact amount, same day and a similar description", () => {
    const hit = scoreDuplicate(incoming(), existing());
    expect(hit).not.toBeNull();
    expect(hit!.score).toBeGreaterThanOrEqual(DUPLICATE_FLAG_THRESHOLD);
    expect(hit!.reasons.amount).toBe("exact");
    expect(hit!.reasons.daysApart).toBe(0);
    expect(hit!.reasons.descriptionsConflict).toBe(false);
  });

  it("treats an identical bank reference as certain", () => {
    const hit = scoreDuplicate(
      incoming({ reference: "REF9284712", description: "totally different words" }),
      existing({ reference: "ref9284712", note: "nothing alike at all here" }),
    );
    expect(hit!.score).toBe(1);
    expect(hit!.reasons.sameReference).toBe(true);
    expect(describeDuplicateReasons(hit!.reasons)).toBe("Same bank reference");
  });

  it("matches a manually-entered transaction, not just imported ones", () => {
    // A manual entry has no reference at all — it must still be compared.
    const manual = existing({ id: "manual-1", reference: undefined });
    expect(isLikelyDuplicate(incoming(), [manual])).toBe(true);
  });

  it("scores same-day higher than several days apart", () => {
    const sameDay = scoreDuplicate(incoming(), existing())!.score;
    const twoDays = scoreDuplicate(incoming(), existing({ date: "2026-06-12" }))!.score;
    // The whole point of a score rather than a boolean.
    expect(sameDay).toBeGreaterThan(twoDays);
  });
});

describe("the date window", () => {
  it("does not flag the same amount ten days apart", () => {
    const hit = scoreDuplicate(incoming(), existing({ date: "2026-06-20" }));
    expect(hit).toBeNull();
    expect(isLikelyDuplicate(incoming(), [existing({ date: "2026-06-20" })])).toBe(false);
  });

  it("compares right up to the edge of the window but not past it", () => {
    const atEdge = `2026-06-${String(10 + DUPLICATE_DATE_WINDOW_DAYS).padStart(2, "0")}`;
    const pastEdge = `2026-06-${String(11 + DUPLICATE_DATE_WINDOW_DAYS).padStart(2, "0")}`;
    expect(scoreDuplicate(incoming(), existing({ date: atEdge }))).not.toBeNull();
    expect(scoreDuplicate(incoming(), existing({ date: pastEdge }))).toBeNull();
  });

  it("looks backwards as well as forwards", () => {
    expect(scoreDuplicate(incoming(), existing({ date: "2026-06-08" }))).not.toBeNull();
  });

  it("honours an overridden window", () => {
    const tenDaysOff = existing({ date: "2026-06-20" });
    expect(scoreDuplicate(incoming(), tenDaysOff, 30)).not.toBeNull();
  });
});

describe("amount tolerance", () => {
  it("flags an amount within tolerance, but below an exact match", () => {
    // 0.6% off — inside the 1% tolerance.
    const near = existing({ amount: Math.round(AMOUNT * 1.006) });
    const hit = scoreDuplicate(incoming(), near);
    expect(hit).not.toBeNull();
    expect(hit!.reasons.amount).toBe("near");
    expect(hit!.score).toBeGreaterThanOrEqual(DUPLICATE_FLAG_THRESHOLD);
    expect(hit!.score).toBeLessThan(scoreDuplicate(incoming(), existing())!.score);
  });

  it("ignores an amount outside tolerance entirely", () => {
    const far = existing({ amount: Math.round(AMOUNT * 1.05) });
    expect(scoreDuplicate(incoming(), far)).toBeNull();
  });

  it("uses the documented tolerance constant", () => {
    const justInside = existing({
      amount: Math.round(AMOUNT * (1 + DUPLICATE_AMOUNT_TOLERANCE * 0.9)),
    });
    const justOutside = existing({
      amount: Math.round(AMOUNT * (1 + DUPLICATE_AMOUNT_TOLERANCE * 2)),
    });
    expect(scoreDuplicate(incoming(), justInside)).not.toBeNull();
    expect(scoreDuplicate(incoming(), justOutside)).toBeNull();
  });
});

describe("coincidental round amounts", () => {
  it("does NOT high-confidence flag two unrelated transactions that merely share an amount", () => {
    // Both ₦5,000, both on the same day, but plainly different things.
    const hit = scoreDuplicate(
      incoming({ description: "Transfer to FRIDAY PATIENCE" }),
      existing({ note: "Fuel at Mobil filling station" }),
    );
    expect(hit).not.toBeNull();
    expect(hit!.reasons.descriptionsConflict).toBe(true);
    expect(hit!.score).toBeLessThan(DUPLICATE_FLAG_THRESHOLD);
    expect(isLikelyDuplicate(
      incoming({ description: "Transfer to FRIDAY PATIENCE" }),
      [existing({ note: "Fuel at Mobil filling station" })],
    )).toBe(false);
  });

  it("still flags them when the descriptions do agree", () => {
    const hit = scoreDuplicate(
      incoming({ description: "Transfer to FRIDAY PATIENCE" }),
      existing({ note: "Transfer to Friday Patience" }),
    );
    expect(hit!.score).toBeGreaterThanOrEqual(DUPLICATE_FLAG_THRESHOLD);
  });

  it("does not punish a terse note it cannot argue from", () => {
    // A one-word manual note is too thin to count as disagreement.
    const hit = scoreDuplicate(incoming(), existing({ note: "Groceries" }));
    expect(hit!.reasons.descriptionsConflict).toBe(false);
  });
});

describe("direction and category", () => {
  it("never matches money in against money out", () => {
    expect(
      scoreDuplicate(incoming({ direction: "in" }), existing({ type: "expense" })),
    ).toBeNull();
    expect(
      scoreDuplicate(incoming({ direction: "out" }), existing({ type: "income" })),
    ).toBeNull();
  });

  it("nudges the score up when the category already agrees", () => {
    const withCategory = scoreDuplicate(
      incoming({ categoryId: "c1" }),
      existing({ categoryId: "c1" }),
    )!;
    const without = scoreDuplicate(incoming(), existing())!;
    expect(withCategory.score).toBeGreaterThan(without.score);
    expect(withCategory.reasons.sameCategory).toBe(true);
  });

  it("does not credit a category the incoming row has not been given", () => {
    const hit = scoreDuplicate(incoming(), existing({ categoryId: "c1" }))!;
    expect(hit.reasons.sameCategory).toBe(false);
  });
});

describe("finding candidates across the ledger", () => {
  const ledger: ExistingTransaction[] = [
    existing({ id: "match-strong" }),
    existing({ id: "match-weak", date: "2026-06-12", note: "Shoprite Lekki" }),
    existing({ id: "unrelated", note: "Fuel at Mobil filling station" }),
    existing({ id: "far", date: "2026-07-20" }),
  ];

  it("returns every candidate above the threshold, strongest first", () => {
    const hits = findDuplicateCandidates(incoming(), ledger);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[0].existing.id).toBe("match-strong");
    expect(hits.map((h) => h.existing.id)).not.toContain("far");
    expect(hits.map((h) => h.existing.id)).not.toContain("unrelated");
  });

  it("is ordered by score descending", () => {
    const scores = findDuplicateCandidates(incoming(), ledger).map((h) => h.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("honours the exclude set, so a batch cannot match its own writes", () => {
    const hits = findDuplicateCandidates(incoming(), ledger, {
      exclude: new Set(["match-strong"]),
    });
    expect(hits.map((h) => h.existing.id)).not.toContain("match-strong");
  });

  it("returns nothing for an empty ledger", () => {
    expect(findDuplicateCandidates(incoming(), [])).toEqual([]);
  });

  it("honours an overridden threshold", () => {
    // Drop the bar and the coincidental round amount does surface.
    const hits = findDuplicateCandidates(
      incoming({ description: "Transfer to FRIDAY PATIENCE" }),
      [existing({ note: "Fuel at Mobil filling station" })],
      { threshold: 0.1 },
    );
    expect(hits).toHaveLength(1);
  });
});

describe("explaining a flag", () => {
  it("says why in plain words", () => {
    const hit = scoreDuplicate(incoming(), existing())!;
    expect(describeDuplicateReasons(hit.reasons)).toContain("Same amount");
    expect(describeDuplicateReasons(hit.reasons)).toContain("same day");
  });

  it("counts the days when they differ", () => {
    const hit = scoreDuplicate(incoming(), existing({ date: "2026-06-11" }))!;
    expect(describeDuplicateReasons(hit.reasons)).toContain("1 day apart");
  });
});
