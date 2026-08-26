import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInitialState } from "@/lib/seed";
import { useAppStore } from "@/store/useAppStore";
import { useToastStore } from "@/store/useToastStore";
import { LearnedRulesPanel } from "./LearnedRulesPanel";

function seedStore() {
  window.localStorage.clear();
  useToastStore.setState({ toasts: [] });
  useAppStore.setState({ state: createInitialState() });
}

function activeRule() {
  const state = useAppStore.getState().state;
  return {
    id: "lr-1",
    source: "statement-import" as const,
    kind: "provider" as const,
    key: "mtn",
    categoryId: state.categories[3].id,
    strength: 2,
    enabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

afterEach(cleanup);

beforeEach(() => {
  seedStore();
});

describe("LearnedRulesPanel (Prompt 6A)", () => {
  it("shows the empty state when nothing has been learned", () => {
    render(<LearnedRulesPanel />);
    expect(screen.getByText("No learned rules yet")).toBeInTheDocument();
  });

  it("lists a rule with its signal, category, strength and status", () => {
    useAppStore.setState((s) => ({
      state: { ...s.state, learnedRules: [activeRule()] },
    }));
    render(<LearnedRulesPanel />);
    expect(screen.getByText(/Provider · mtn/)).toBeInTheDocument();
    expect(screen.getByText(/2 corrections/)).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("marks a candidate rule as waiting for more corrections", () => {
    useAppStore.setState((s) => ({
      state: {
        ...s.state,
        learnedRules: [{ ...activeRule(), strength: 1, enabled: false }],
      },
    }));
    render(<LearnedRulesPanel />);
    expect(screen.getByText("Candidate")).toBeInTheDocument();
    expect(screen.getByText(/needs 1 more to activate/)).toBeInTheDocument();
  });

  it("disables a rule via the toggle", async () => {
    const user = userEvent.setup();
    useAppStore.setState((s) => ({
      state: { ...s.state, learnedRules: [activeRule()] },
    }));
    render(<LearnedRulesPanel />);
    await user.click(screen.getByRole("checkbox", { name: 'Toggle rule "mtn"' }));
    expect(useAppStore.getState().state.learnedRules[0].enabled).toBe(false);
  });

  it("re-targets a rule via the category select", async () => {
    const user = userEvent.setup();
    const state = useAppStore.getState().state;
    useAppStore.setState({
      state: { ...state, learnedRules: [activeRule()] },
    });
    render(<LearnedRulesPanel />);
    const other = useAppStore.getState().state.categories[4].id;
    await user.selectOptions(
      screen.getByRole("combobox", { name: 'Category for rule "mtn"' }),
      other,
    );
    expect(useAppStore.getState().state.learnedRules[0].categoryId).toBe(other);
  });

  it("deletes a rule after confirmation", async () => {
    const user = userEvent.setup();
    useAppStore.setState((s) => ({
      state: { ...s.state, learnedRules: [activeRule()] },
    }));
    render(<LearnedRulesPanel />);
    await user.click(screen.getByRole("button", { name: 'Delete rule "mtn"' }));
    const dialog = screen.getByRole("dialog", { name: "Delete learned rule" });
    await user.click(within(dialog).getByRole("button", { name: "Delete rule" }));
    expect(useAppStore.getState().state.learnedRules).toHaveLength(0);
    expect(screen.getByText("No learned rules yet")).toBeInTheDocument();
  });
});
describe("clearing every learned mapping", () => {
  beforeEach(seedStore);

  function seedTwoRules() {
    const state = useAppStore.getState().state;
    useAppStore.setState({
      state: {
        ...state,
        learnedRules: [
          activeRule(),
          {
            ...activeRule(),
            id: "lr-2",
            kind: "merchant" as const,
            key: "shoprite lekki",
            categoryId: state.categories[1].id,
          },
        ],
      },
    });
  }

  it("offers Clear all only when there is something to clear", () => {
    render(<LearnedRulesPanel />);
    expect(screen.queryAllByRole("button", { name: "Clear all" })).toHaveLength(0);

    cleanup();
    seedTwoRules();
    render(<LearnedRulesPanel />);
    expect(screen.getAllByRole("button", { name: "Clear all" })).toHaveLength(1);
  });

  it("confirms first, then removes every mapping", async () => {
    const user = userEvent.setup();
    seedTwoRules();
    render(<LearnedRulesPanel />);

    await user.click(screen.getAllByRole("button", { name: "Clear all" })[0]);
    // Nothing is destroyed until the user confirms.
    expect(useAppStore.getState().state.learnedRules).toHaveLength(2);
    expect(screen.getByText(/All 2 learned rules will be removed/)).toBeInTheDocument();

    // [0] is the panel trigger, [1] the dialog's confirm.
    await user.click(screen.getAllByRole("button", { name: "Clear all" })[1]);
    expect(useAppStore.getState().state.learnedRules).toEqual([]);
  });

  it("leaves categories and transactions untouched", async () => {
    const user = userEvent.setup();
    seedTwoRules();
    const before = useAppStore.getState().state.categories;
    render(<LearnedRulesPanel />);

    await user.click(screen.getAllByRole("button", { name: "Clear all" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Clear all" })[1]);

    expect(useAppStore.getState().state.categories).toEqual(before);
    expect(useAppStore.getState().state.transactions).toEqual([]);
  });
});
