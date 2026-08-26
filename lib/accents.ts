export interface CategoryAccent {
  chip: string;
  dot: string;
}

/** Shared fallback so every category-colored chart matches the Planner. */
export const CATEGORY_COLOR_FALLBACK = "#0ea5e9";

export function categoryColor(category?: { color?: string } | null): string {
  return category?.color || CATEGORY_COLOR_FALLBACK;
}

const NEUTRAL: CategoryAccent = {
  chip: "bg-canvas text-muted",
  dot: "bg-border",
};

const ACCENTS: ReadonlyArray<{ keywords: readonly string[]; accent: CategoryAccent }> = [
  {
    keywords: ["entertainment", "movie", "cinema", "game", "stream", "music"],
    accent: {
      chip: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      dot: "bg-purple-500",
    },
  },
  {
    keywords: ["food", "grocery", "groceries", "restaurant", "cafe", "market", "snack"],
    accent: {
      chip: "bg-green-500/10 text-green-600 dark:text-green-400",
      dot: "bg-green-500",
    },
  },
  {
    keywords: ["loan", "debt", "interest", "borrow", "credit card", "installment"],
    accent: {
      chip: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      dot: "bg-violet-500",
    },
  },
  {
    keywords: ["transport", "fuel", "bus", "train", "taxi", "uber", "car", "parking"],
    accent: {
      chip: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
      dot: "bg-yellow-500",
    },
  },
  {
    keywords: ["housing", "rent", "mortgage", "apartment", "real estate"],
    accent: {
      chip: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      dot: "bg-blue-500",
    },
  },
  {
    keywords: ["utility", "utilities", "electric", "water", "internet", "phone", "power", "bill"],
    accent: {
      chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
    },
  },
  {
    keywords: ["health", "medical", "doctor", "pharmacy", "medicine", "gym", "dentist"],
    accent: {
      chip: "bg-red-500/10 text-red-600 dark:text-red-400",
      dot: "bg-red-500",
    },
  },
  {
    keywords: ["shopping", "cloth", "fashion", "shoe", "gift", "mall", "amazon"],
    accent: {
      chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      dot: "bg-orange-500",
    },
  },
  {
    keywords: ["subscription", "subscriptions", "netflix", "spotify", "prime", "disney", "apple", "software", "cloud"],
    accent: {
      chip: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
      dot: "bg-cyan-500",
    },
  },
];

export function categoryAccent(name: string): CategoryAccent {
  const lower = name.toLowerCase();
  for (const { keywords, accent } of ACCENTS) {
    if (keywords.some((keyword) => lower.includes(keyword))) return accent;
  }
  return NEUTRAL;
}

export interface BudgetRowTreatment {
  /** Extremely subtle pastel row background (rgba). */
  tint: string;
  /** Stronger accent hex used for the progress bar and percentage. */
  strong: string;
}

/** Reference palette for the Planner's seven budget categories. */
const BUDGET_ROW_TINTS: Record<string, string> = {
  transport: "rgba(251, 191, 36, 0.09)", // very light warm cream/yellow
  loan: "rgba(216, 180, 254, 0.10)", // very light pink/lilac
  edi: "rgba(252, 165, 165, 0.10)", // very light red/pink
  misc: "rgba(148, 163, 184, 0.10)", // very light cool gray/blue
  essentials: "rgba(251, 113, 133, 0.08)", // very light pink/red
  internet: "rgba(251, 146, 60, 0.10)", // very light warm peach/orange
  palmpay: "rgba(125, 211, 252, 0.10)", // very light blue
};

const BUDGET_ROW_STRONG: Record<string, string> = {
  transport: "#14b8a6", // teal
  loan: "#14b8a6", // teal
  edi: "#ef4444", // red
  misc: "#6b7280", // muted gray
  essentials: "#ef4444", // red
  internet: "#f97316", // orange
  palmpay: "#0ea5e9", // teal/blue
};

export function budgetRowTreatment(
  category?: { name?: string; color?: string } | null,
): BudgetRowTreatment {
  const name = (category?.name ?? "").toLowerCase();
  const tint = BUDGET_ROW_TINTS[name];
  if (tint) {
    return { tint, strong: BUDGET_ROW_STRONG[name] };
  }
  return {
    tint: `${categoryColor(category)}12`,
    strong: "var(--color-brand-500)",
  };
}
