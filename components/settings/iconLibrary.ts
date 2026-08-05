import type { ComponentType } from "react";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  FileTextIcon,
  GridIcon,
  PlusIcon,
  RepeatIcon,
  SparklesIcon,
  TargetIcon,
  TrendDownIcon,
  TrendingUpIcon,
  WalletIcon,
} from "@/components/ui/icons";

export type IconKind = "emoji" | "vector";

export interface IconOption {
  emoji: string;
  label: string;
  kind?: IconKind;
  keywords?: string[];
}

export const DEFAULT_ICON = "💰";

/** Lucide-style line icons shipped by the app. Values are stored as their key. */
export const VECTOR_ICON_COMPONENTS: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  wallet: WalletIcon,
  chart: ChartIcon,
  "trend-up": TrendingUpIcon,
  "trend-down": TrendDownIcon,
  target: TargetIcon,
  calendar: CalendarIcon,
  clock: ClockIcon,
  repeat: RepeatIcon,
  file: FileTextIcon,
  sparkles: SparklesIcon,
  "arrow-up-right": ArrowUpRightIcon,
  "arrow-down-left": ArrowDownLeftIcon,
  plus: PlusIcon,
  grid: GridIcon,
};

export function isVectorIcon(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(VECTOR_ICON_COMPONENTS, value);
}

export interface IconGroup {
  id: string;
  label: string;
  icons: IconOption[];
}

export const ICON_GROUPS: IconGroup[] = [
  {
    id: "finance",
    label: "Finance",
    icons: [
      { emoji: "💰", label: "Piggy bank", keywords: ["money", "savings", "save", "deposit"] },
      { emoji: "💵", label: "Cash", keywords: ["money", "cash", "salary", "income", "withdraw"] },
      { emoji: "💳", label: "Card", keywords: ["card", "credit", "payment", "subscription"] },
      { emoji: "🏦", label: "Bank", keywords: ["bank", "fees", "loan", "mortgage", "account"] },
      { emoji: "🪙", label: "Coin", keywords: ["coin", "change", "savings", "fees"] },
      { emoji: "💱", label: "Exchange", keywords: ["exchange", "currency", "foreign", "forex"] },
      { emoji: "📈", label: "Growth", keywords: ["growth", "invest", "investment", "stock", "portfolio"] },
      { emoji: "🎁", label: "Gift", keywords: ["gift", "present", "birthday", "reward"] },
    ],
  },
  {
    id: "home",
    label: "Home & utilities",
    icons: [
      { emoji: "🏠", label: "House", keywords: ["home", "house", "rent", "housing", "housing"] },
      { emoji: "🏘️", label: "Housing", keywords: ["housing", "neighbourhood", "roommate"] },
      { emoji: "🏢", label: "Building", keywords: ["building", "office", "condo", "apartment"] },
      { emoji: "💡", label: "Light", keywords: ["light", "electricity", "power", "bulb"] },
      { emoji: "⚡", label: "Electricity", keywords: ["electricity", "energy", "power", "bill"] },
      { emoji: "💧", label: "Water", keywords: ["water", "water bill", "utilities"] },
      { emoji: "🌊", label: "Waves", keywords: ["waves", "pool", "utilities", "water"] },
      { emoji: "🔥", label: "Fire", keywords: ["fire", "heating", "energy", "heat"] },
      { emoji: "🧹", label: "Cleaning", keywords: ["cleaning", "home", "housework"] },
    ],
  },
  {
    id: "shopping",
    label: "Shopping & food",
    icons: [
      { emoji: "🛒", label: "Cart", keywords: ["groceries", "shopping", "cart", "grocer"] },
      { emoji: "🏪", label: "Store", keywords: ["store", "shop", "market", "convenience"] },
      { emoji: "🛍️", label: "Bags", keywords: ["shopping", "bags", "retail", "clothes"] },
      { emoji: "🍎", label: "Apple", keywords: ["apple", "fruit", "groceries", "healthy"] },
      { emoji: "🍕", label: "Pizza", keywords: ["pizza", "food", "takeout", "lunch"] },
      { emoji: "🍔", label: "Burger", keywords: ["burger", "fast food", "food"] },
      { emoji: "🍜", label: "Noodles", keywords: ["noodles", "ramen", "food", "takeout"] },
      { emoji: "☕", label: "Coffee", keywords: ["coffee", "cafe", "drink", "breakfast"] },
      { emoji: "🥗", label: "Salad", keywords: ["salad", "healthy", "lunch", "food"] },
      { emoji: "🥤", label: "Drink", keywords: ["drink", "soda", "juice", "fast food"] },
    ],
  },
  {
    id: "transport",
    label: "Transport",
    icons: [
      { emoji: "🚌", label: "Bus", keywords: ["bus", "transport", "commute", "public"] },
      { emoji: "🚗", label: "Car", keywords: ["car", "transport", "parking", "fuel"] },
      { emoji: "🚕", label: "Taxi", keywords: ["taxi", "ride", "uber", "lyft"] },
      { emoji: "🚆", label: "Train", keywords: ["train", "rail", "commute", "subway"] },
      { emoji: "🚲", label: "Bike", keywords: ["bike", "cycling", "transport"] },
      { emoji: "⛽", label: "Fuel", keywords: ["fuel", "gas", "petrol", "car"] },
      { emoji: "🅿️", label: "Parking", keywords: ["parking", "car", "garage"] },
      { emoji: "✈️", label: "Plane", keywords: ["plane", "flight", "travel", "airfare", "air"] },
    ],
  },
  {
    id: "lifestyle",
    label: "Lifestyle & family",
    icons: [
      { emoji: "👕", label: "Clothes", keywords: ["clothes", "clothing", "fashion", "apparel"] },
      { emoji: "👶", label: "Babies", keywords: ["baby", "kids", "children", "nursery"] },
      { emoji: "🎓", label: "Education", keywords: ["school", "tuition", "education", "studies"] },
      { emoji: "💪", label: "Fitness", keywords: ["gym", "fitness", "gym", "health"] },
      { emoji: "💅", label: "Beauty", keywords: ["beauty", "salon", "nails", "grooming"] },
      { emoji: "💇", label: "Haircut", keywords: ["haircut", "barber", "hair", "salon"] },
      { emoji: "🐾", label: "Pets", keywords: ["pets", "vet", "dog", "cat", "animal"] },
      { emoji: "🧸", label: "Toys", keywords: ["toys", "kids", "play"] },
    ],
  },
  {
    id: "entertainment",
    label: "Entertainment",
    icons: [
      { emoji: "🎬", label: "Movie", keywords: ["movie", "cinema", "film", "streaming"] },
      { emoji: "🎮", label: "Games", keywords: ["games", "gaming", "play"] },
      { emoji: "🎧", label: "Headphones", keywords: ["headphones", "music", "podcasts", "audio"] },
      { emoji: "🎶", label: "Music", keywords: ["music", "songs", "concert"] },
      { emoji: "🎵", label: "Music note", keywords: ["music", "song"] },
      { emoji: "🎼", label: "Sheet", keywords: ["music", "score", "sheet"] },
      { emoji: "🎤", label: "Microphone", keywords: ["mic", "karaoke", "singing"] },
      { emoji: "🎹", label: "Piano", keywords: ["piano", "music", "instrument"] },
      { emoji: "🎸", label: "Guitar", keywords: ["guitar", "music", "instrument"] },
      { emoji: "🎷", label: "Saxophone", keywords: ["saxophone", "music", "jazz"] },
      { emoji: "🎺", label: "Trumpet", keywords: ["trumpet", "music", "brass"] },
      { emoji: "🥁", label: "Drum", keywords: ["drum", "music", "percussion"] },
      { emoji: "🎲", label: "Dice", keywords: ["dice", "gambling", "board game"] },
      { emoji: "♟️", label: "Chess", keywords: ["chess", "game", "hobby"] },
      { emoji: "🎯", label: "Target", keywords: ["target", "goal", "fitness", "archery"] },
    ],
  },
  {
    id: "health",
    label: "Health & care",
    icons: [
      { emoji: "🏥", label: "Hospital", keywords: ["hospital", "medical", "health"] },
      { emoji: "⚕️", label: "Medical", keywords: ["medical", "health", "doctor", "care"] },
      { emoji: "💊", label: "Pill", keywords: ["pill", "medicine", "pharmacy", "drugs"] },
      { emoji: "🧴", label: "Lotion", keywords: ["lotion", "care", "supplies"] },
      { emoji: "🚑", label: "Ambulance", keywords: ["ambulance", "emergency", "medical"] },
      { emoji: "🧘", label: "Wellness", keywords: ["wellness", "meditation", "yoga", "health"] },
      { emoji: "🏋️", label: "Gym", keywords: ["gym", "workout", "fitness"] },
    ],
  },
  {
    id: "nature",
    label: "Nature & outdoors",
    icons: [
      { emoji: "🌿", label: "Leaf", keywords: ["plant", "leaf", "garden", "eco"] },
      { emoji: "🌸", label: "Flower", keywords: ["flower", "garden", "florist"] },
      { emoji: "🦋", label: "Butterfly", keywords: ["butterfly", "nature", "garden"] },
      { emoji: "🐞", label: "Ladybug", keywords: ["ladybug", "nature", "garden"] },
      { emoji: "🏖️", label: "Beach", keywords: ["beach", "vacation", "summer", "holiday"] },
      { emoji: "🏔️", label: "Mountains", keywords: ["mountain", "travel", "hiking", "outdoors"] },
      { emoji: "🏕️", label: "Camping", keywords: ["camping", "outdoors", "hike"] },
      { emoji: "🌲", label: "Tree", keywords: ["tree", "nature", "forest", "park"] },
    ],
  },
  {
    id: "tech",
    label: "Tech & office",
    icons: [
      { emoji: "💻", label: "Laptop", keywords: ["laptop", "work", "software", "computer"] },
      { emoji: "🖥️", label: "Computer", keywords: ["computer", "desktop", "work"] },
      { emoji: "📱", label: "Phone", keywords: ["phone", "mobile", "telecom", "subscription"] },
      { emoji: "⌨️", label: "Keyboard", keywords: ["keyboard", "tech", "accessories"] },
      { emoji: "🖱️", label: "Mouse", keywords: ["mouse", "tech", "accessories"] },
      { emoji: "🖨️", label: "Printer", keywords: ["printer", "office", "paper"] },
      { emoji: "📷", label: "Camera", keywords: ["camera", "photo", "photography"] },
      { emoji: "📹", label: "Video", keywords: ["video", "recording", "camera"] },
      { emoji: "📚", label: "Books", keywords: ["books", "study", "library", "reading"] },
      { emoji: "📊", label: "Chart", keywords: ["analytics", "report", "data", "stats"] },
    ],
  },
  {
    id: "vectors",
    label: "Line icons",
    icons: [
      { emoji: "wallet", label: "Wallet", kind: "vector", keywords: ["salary", "income", "bank", "payout", "cash", "wallet"] },
      { emoji: "trend-up", label: "Trend up", kind: "vector", keywords: ["growth", "investment", "stocks", "profit", "up"] },
      { emoji: "trend-down", label: "Trend down", kind: "vector", keywords: ["forex", "loss", "down", "market"] },
      { emoji: "chart", label: "Chart bars", kind: "vector", keywords: ["business", "report", "stats", "data"] },
      { emoji: "target", label: "Target", kind: "vector", keywords: ["goal", "commission", "target", "milestone"] },
      { emoji: "calendar", label: "Calendar", kind: "vector", keywords: ["schedule", "planning", "monthly", "recurring"] },
      { emoji: "clock", label: "Clock", kind: "vector", keywords: ["time", "hourly", "overtime", "schedule"] },
      { emoji: "repeat", label: "Recurring", kind: "vector", keywords: ["recurring", "repeat", "subsidy", "allowance"] },
      { emoji: "file", label: "Document", kind: "vector", keywords: ["contract", "consulting", "invoice", "work"] },
      { emoji: "sparkles", label: "Sparkles", kind: "vector", keywords: ["bonus", "extra", "reward", "gift"] },
      { emoji: "arrow-up-right", label: "Arrow up right", kind: "vector", keywords: ["income", "increase", "raise"] },
      { emoji: "arrow-down-left", label: "Arrow down left", kind: "vector", keywords: ["payout", "withdraw", "transfer"] },
      { emoji: "plus", label: "Plus", kind: "vector", keywords: ["add", "new", "extra"] },
      { emoji: "grid", label: "Grid", kind: "vector", keywords: ["overview", "dashboard", "admin"] },
    ],
  },
];

const FLAT_ICONS: IconOption[] = ICON_GROUPS.flatMap((group) => group.icons);

const BY_EMOJI: Record<string, IconOption> = Object.fromEntries(
  FLAT_ICONS.map((icon) => [icon.emoji, icon]),
);

export function findIconByEmoji(emoji: string): IconOption | undefined {
  return BY_EMOJI[emoji];
}

export function labelForEmoji(emoji: string): string | undefined {
  return BY_EMOJI[emoji]?.label;
}

export function matchIcon(icon: IconOption, query: string): boolean {
  if (query.length === 0) return true;
  if (icon.emoji === query) return true;
  const labels = [icon.label, ...(icon.keywords ?? [])];
  return labels.some((label) => label.toLowerCase().includes(query));
}