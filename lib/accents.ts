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
