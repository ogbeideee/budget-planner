import { beforeEach, describe, expect, it } from "vitest";
import { setWritesEnabled } from "@/lib/storage";
import { totals } from "@/lib/selectors";
import { createAppStore } from "../useAppStore";

type Store = ReturnType<typeof createAppStore>;

beforeEach(() => {
  window.localStorage.clear();
  setWritesEnabled(true);
});

function expenseCategory(store: Store) {
  return store.getState().state.categories.find((c) => c.kind === "expense")!;
}

describe("savings plans (FR-28)", () => {
  it("creates a plan with the form's fields and an active status", () => {
    const store = createAppStore();
    store.getState().addSavingsPlan({
      name: "Emergency fund",
      targetAmount: 500_000,
      targetDate: "2026-12-01",
      startingBalance: 50_000,
    });
    const plans = store.getState().state.savingsPlans;
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      name: "Emergency fund",
      targetAmount: 500_000,
      targetDate: "2026-12-01",
      startingBalance: 50_000,
      status: "active",
    });
    expect(plans[0].createdAt).toBeTruthy();
  });

  it("stores a missing target date as absent (open-ended), never an empty string", () => {
    const store = createAppStore();
    store.getState().addSavingsPlan({ name: "Trip", targetAmount: 100_000 });
    expect(store.getState().state.savingsPlans[0].targetDate).toBeUndefined();
  });

  it("refuses a blank name", () => {
    const store = createAppStore();
    store.getState().addSavingsPlan({ name: "   ", targetAmount: 100_000 });
    expect(store.getState().state.savingsPlans).toHaveLength(0);
  });

  it("edits only the user-facing fields", () => {
    const store = createAppStore();
    store.getState().addSavingsPlan({ name: "Laptop", targetAmount: 900_000 });
    const id = store.getState().state.savingsPlans[0].id;
    const createdAt = store.getState().state.savingsPlans[0].createdAt;
    store.getState().updateSavingsPlan(id, {
      name: "New laptop",
      targetAmount: 1_200_000,
    });
    const updated = store.getState().state.savingsPlans[0];
    expect(updated.name).toBe("New laptop");
    expect(updated.targetAmount).toBe(1_200_000);
    expect(updated.createdAt).toBe(createdAt);
    expect(updated.status).toBe("active");
  });

  it("logs a contribution through the ordinary addTransaction path, tagged", () => {
    const store = createAppStore();
    const categoryId = expenseCategory(store).id;
    store.getState().addSavingsPlan({ name: "Laptop", targetAmount: 900_000 });
    const planId = store.getState().state.savingsPlans[0].id;
    store.getState().addTransaction({
      categoryId,
      amount: 25_000,
      type: "expense",
      date: "2026-03-05",
      savingsPlanId: planId,
    });
    const transactions = store.getState().state.transactions;
    expect(transactions).toHaveLength(1);
    expect(transactions[0].savingsPlanId).toBe(planId);
    expect(transactions[0].type).toBe("expense");
  });

  it("stamp-completes and archives via setSavingsPlanStatus", () => {
    const store = createAppStore();
    store.getState().addSavingsPlan({ name: "Laptop", targetAmount: 900_000 });
    const id = store.getState().state.savingsPlans[0].id;
    store.getState().setSavingsPlanStatus(id, "completed");
    const completed = store.getState().state.savingsPlans[0];
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeTruthy();

    store.getState().setSavingsPlanStatus(id, "archived");
    const archived = store.getState().state.savingsPlans[0];
    expect(archived.status).toBe("archived");
    expect(archived.archivedAt).toBeTruthy();
    // The reached-the-target fact survives archiving.
    expect(archived.completedAt).toBe(completed.completedAt);
  });

  it("deletes a plan with no contributions, refuses one with history", () => {
    const store = createAppStore();
    const categoryId = expenseCategory(store).id;
    store.getState().addSavingsPlan({ name: "Empty", targetAmount: 100 });
    store.getState().addSavingsPlan({ name: "Funded", targetAmount: 100 });
    const [empty, funded] = store.getState().state.savingsPlans;

    expect(store.getState().deleteSavingsPlan(empty.id).ok).toBe(true);
    expect(
      store.getState().state.savingsPlans.some((p) => p.id === empty.id),
    ).toBe(false);

    store.getState().addTransaction({
      categoryId,
      amount: 10_000,
      type: "expense",
      date: "2026-03-05",
      savingsPlanId: funded.id,
    });
    const refused = store.getState().deleteSavingsPlan(funded.id);
    expect(refused.ok).toBe(false);
    expect(refused.reason).toBe("in-use-transactions");
    // The plan stays; archive is the way out, deletion is not.
    expect(store.getState().state.savingsPlans).toHaveLength(1);
  });

  it("keeps contributions out of report totals once tagged", () => {
    const store = createAppStore();
    const categoryId = expenseCategory(store).id;
    store.getState().addTransaction({
      categoryId,
      amount: 40_000,
      type: "expense",
      date: "2026-03-05",
    });
    store.getState().addSavingsPlan({ name: "Laptop", targetAmount: 900_000 });
    const planId = store.getState().state.savingsPlans[0].id;
    store.getState().addTransaction({
      categoryId,
      amount: 10_000,
      type: "expense",
      date: "2026-03-06",
      savingsPlanId: planId,
    });
    // 50k left the envelope, but Reports sees only the 40k actually spent.
    expect(totals(store.getState().state.transactions, "2026-03").expenses).toBe(
      40_000,
    );
  });
});
