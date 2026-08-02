import { describe, expect, it } from "vitest";
import {
  generateInstances,
  generatedInstanceId,
  hasGeneratedInstance,
  recordException,
} from "../recurrence";
import type { RecurrenceRule, Transaction } from "../types";

function rule(overrides: Partial<RecurrenceRule> = {}): RecurrenceRule {
  return {
    id: "rule-1",
    categoryId: "cat-1",
    amount: 25000,
    type: "expense",
    frequency: "weekly",
    anchorDate: "2026-08-03",
    enabled: true,
    exceptions: {},
    ...overrides,
  };
}

describe("generateInstances — weekly (AC-06)", () => {
  it("yields 5 instances in August 2026 for a Monday anchor", () => {
    const instances = generateInstances(rule(), "2026-08");
    expect(instances).toHaveLength(5);
    expect(instances.map((i) => i.date)).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
    ]);
  });

  it("copies amount, category, type and note", () => {
    const [instance] = generateInstances(
      rule({ amount: 999, note: "rent" }),
      "2026-08",
    );
    expect(instance.amount).toBe(999);
    expect(instance.categoryId).toBe("cat-1");
    expect(instance.type).toBe("expense");
    expect(instance.note).toBe("rent");
    expect(instance.recurringRuleId).toBe("rule-1");
  });
});

describe("generateInstances — monthly", () => {
  it("clamps day-of-month to month length", () => {
    const instances = generateInstances(
      rule({ frequency: "monthly", anchorDate: "2026-01-31" }),
      "2026-02",
    );
    expect(instances.map((i) => i.date)).toEqual(["2026-02-28"]);
  });

  it("produces one instance in the anchor month", () => {
    const instances = generateInstances(
      rule({ frequency: "monthly", anchorDate: "2026-08-15" }),
      "2026-08",
    );
    expect(instances.map((i) => i.date)).toEqual(["2026-08-15"]);
  });

  it("recurs in every month with a clamped day", () => {
    const instances = generateInstances(
      rule({ frequency: "monthly", anchorDate: "2026-08-15" }),
      "2026-09",
    );
    expect(instances.map((i) => i.date)).toEqual(["2026-09-15"]);
  });
});

describe("generateInstances — yearly", () => {
  it("generates one instance in the anchor month/year", () => {
    const instances = generateInstances(
      rule({ frequency: "yearly", anchorDate: "2026-08-15" }),
      "2026-08",
    );
    expect(instances.map((i) => i.date)).toEqual(["2026-08-15"]);
  });

  it("generates nothing in other months", () => {
    const instances = generateInstances(
      rule({ frequency: "yearly", anchorDate: "2026-08-15" }),
      "2026-07",
    );
    expect(instances).toHaveLength(0);
  });
});

describe("generateInstances — exceptions (AC-07)", () => {
  it("excludes dates listed in exceptions", () => {
    const withException = rule({
      exceptions: {
        "2026-08": [generatedInstanceId("rule-1", "2026-08-10")],
      },
    });
    const instances = generateInstances(withException, "2026-08");
    expect(instances).toHaveLength(4);
    expect(instances.map((i) => i.date)).not.toContain("2026-08-10");
  });

  it("skips the whole month when exceptions is 'skipped'", () => {
    const skipped = rule({ exceptions: { "2026-08": "skipped" } });
    expect(generateInstances(skipped, "2026-08")).toHaveLength(0);
  });

  it("keeps deterministic ids across regenerations", () => {
    const [a] = generateInstances(rule(), "2026-08");
    const [b] = generateInstances(rule(), "2026-08");
    expect(a.id).toBe(b.id);
    expect(a.id).toBe(generatedInstanceId("rule-1", "2026-08-03"));
  });

  it("does not regenerate dates already covered by a generated instance", () => {
    const [instance] = generateInstances(rule(), "2026-08");
    const existing: Transaction[] = [instance];
    const candidates = generateInstances(rule(), "2026-08").filter(
      (candidate) => !hasGeneratedInstance(existing, "rule-1", candidate.date),
    );
    expect(candidates.map((candidate) => candidate.date)).not.toContain(
      "2026-08-03",
    );
    expect(candidates).toHaveLength(4);
  });
});

describe("generateInstances — disabled", () => {
  it("generates nothing for a disabled rule", () => {
    expect(generateInstances(rule({ enabled: false }), "2026-08")).toHaveLength(0);
  });
});

describe("recordException (AC-17)", () => {
  it("appends an id for a new month and excludes the instance from regeneration", () => {
    const next = recordException(rule(), "2026-08", "rule-1:2026-08-03");
    expect(next.exceptions["2026-08"]).toEqual(["rule-1:2026-08-03"]);
    expect(generateInstances(next, "2026-08")).toHaveLength(4);
  });

  it("is idempotent", () => {
    const once = recordException(rule(), "2026-08", "rule-1:2026-08-03");
    const twice = recordException(once, "2026-08", "rule-1:2026-08-03");
    expect(twice.exceptions["2026-08"]).toEqual(["rule-1:2026-08-03"]);
  });

  it("replaces 'skipped' with an id list", () => {
    const next = recordException(
      rule({ exceptions: { "2026-08": "skipped" } }),
      "2026-08",
      "rule-1:2026-08-10",
    );
    expect(next.exceptions["2026-08"]).toEqual(["rule-1:2026-08-10"]);
  });
});
