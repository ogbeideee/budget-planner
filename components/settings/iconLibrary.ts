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
    id: "food",
    label: "Food & dining",
    icons: [
      { emoji: "🛒", label: "Groceries", keywords: ["groceries", "supermarket", "shopping", "food shop"] },
      { emoji: "🧺", label: "Basket", keywords: ["basket", "essentials", "household", "provisions"] },
      { emoji: "🍎", label: "Fruit", keywords: ["fruit", "apple", "fresh", "healthy", "produce", "groceries"] },
      { emoji: "🥦", label: "Vegetables", keywords: ["vegetables", "greens", "produce", "healthy"] },
      { emoji: "🍞", label: "Bakery", keywords: ["bread", "bakery", "baking"] },
      { emoji: "🥩", label: "Meat", keywords: ["meat", "butcher", "protein"] },
      { emoji: "🐟", label: "Fish", keywords: ["fish", "seafood", "market"] },
      { emoji: "🍽️", label: "Dining out", keywords: ["dining", "dining out", "restaurant", "eat out", "meal"] },
      { emoji: "🍕", label: "Pizza", keywords: ["pizza", "takeaway", "delivery"] },
      { emoji: "🍔", label: "Fast food", keywords: ["burger", "fast food", "takeout"] },
      { emoji: "🍜", label: "Noodles", keywords: ["noodles", "ramen", "soup", "takeout"] },
      { emoji: "🍱", label: "Takeaway", keywords: ["takeaway", "lunchbox", "bento", "meal prep"] },
      { emoji: "☕", label: "Coffee", keywords: ["coffee", "cafe", "tea", "breakfast"] },
      { emoji: "🥗", label: "Salad", keywords: ["salad", "healthy", "lunch"] },
      { emoji: "🥤", label: "Soft drink", keywords: ["drink", "soda", "juice", "beverage"] },
      { emoji: "🍺", label: "Bar", keywords: ["beer", "bar", "alcohol", "drinks", "pub"] },
      { emoji: "🍷", label: "Wine", keywords: ["wine", "alcohol", "drinks"] },
    ],
  },
  {
    id: "housing",
    label: "Housing",
    icons: [
      { emoji: "🏠", label: "House", keywords: ["home", "house", "rent", "housing"] },
      { emoji: "🏘️", label: "Housing", keywords: ["housing", "neighbourhood", "estate", "roommate"] },
      { emoji: "🏢", label: "Apartment", keywords: ["apartment", "building", "condo", "office block"] },
      { emoji: "🔑", label: "Rent", keywords: ["rent", "keys", "lease", "deposit"] },
      { emoji: "🏦", label: "Mortgage", keywords: ["mortgage", "home loan", "property", "bank"] },
      { emoji: "🔨", label: "Repairs", keywords: ["repairs", "maintenance", "diy", "fixing"] },
      { emoji: "🛋️", label: "Furniture", keywords: ["furniture", "sofa", "living room", "furnishing"] },
      { emoji: "🛏️", label: "Bedroom", keywords: ["bed", "bedroom", "mattress", "furnishing"] },
      { emoji: "🧹", label: "Cleaning", keywords: ["cleaning", "housework", "chores"] },
      { emoji: "🪴", label: "Houseplants", keywords: ["plants", "houseplant", "indoor garden"] },
    ],
  },
  {
    id: "utilities",
    label: "Utilities",
    icons: [
      { emoji: "💡", label: "Electricity", keywords: ["light", "electricity", "power", "bulb", "utilities"] },
      { emoji: "⚡", label: "Energy", keywords: ["energy", "power", "prepaid", "units"] },
      { emoji: "💧", label: "Water", keywords: ["water", "water bill", "plumbing", "utilities"] },
      { emoji: "🚰", label: "Water supply", keywords: ["tap", "water supply", "borehole"] },
      { emoji: "🔥", label: "Gas", keywords: ["gas", "heating", "cooking gas", "utilities"] },
      { emoji: "🗑️", label: "Waste", keywords: ["waste", "refuse", "bins", "disposal", "utilities"] },
      { emoji: "🌊", label: "Waves", keywords: ["waves", "pool", "water"] },
    ],
  },
  {
    id: "connectivity",
    label: "Connectivity",
    icons: [
      { emoji: "🌐", label: "Internet", keywords: ["internet", "wifi", "broadband", "web", "online"] },
      { emoji: "📶", label: "Airtime", keywords: ["airtime", "data", "mobile data", "network", "signal", "recharge", "top up"] },
      { emoji: "📱", label: "Phone", keywords: ["phone", "mobile", "handset", "telecom"] },
      { emoji: "☎️", label: "Calls", keywords: ["calls", "landline", "telephone"] },
      { emoji: "📡", label: "Satellite", keywords: ["satellite", "cable", "dish", "decoder"] },
      { emoji: "📺", label: "Streaming", keywords: ["tv", "television", "streaming", "subscription"] },
    ],
  },
  {
    id: "transport",
    label: "Transport",
    icons: [
      { emoji: "🚗", label: "Car", keywords: ["car", "vehicle", "driving", "motor"] },
      { emoji: "⛽", label: "Fuel", keywords: ["fuel", "petrol", "diesel", "gas station"] },
      { emoji: "🚌", label: "Bus", keywords: ["bus", "transport", "commute", "public"] },
      { emoji: "🚆", label: "Train", keywords: ["train", "rail", "metro", "subway", "commute"] },
      { emoji: "🚕", label: "Taxi", keywords: ["taxi", "cab", "ride hailing", "uber", "bolt"] },
      { emoji: "🛵", label: "Bike delivery", keywords: ["scooter", "okada", "motorbike", "delivery"] },
      { emoji: "🚲", label: "Bicycle", keywords: ["bike", "bicycle", "cycling"] },
      { emoji: "🅿️", label: "Parking", keywords: ["parking", "garage", "car park"] },
      { emoji: "🔧", label: "Servicing", keywords: ["servicing", "mechanic", "car repairs"] },
      { emoji: "✈️", label: "Flights", keywords: ["plane", "flight", "airfare", "travel"] },
      { emoji: "🚢", label: "Ferry", keywords: ["ferry", "boat", "shipping"] },
    ],
  },
  {
    id: "financial",
    label: "Financial",
    icons: [
      { emoji: "💰", label: "Savings", keywords: ["savings", "save", "money", "piggy bank"] },
      { emoji: "💵", label: "Cash", keywords: ["cash", "money", "salary", "withdrawal"] },
      { emoji: "💳", label: "Card", keywords: ["card", "credit", "debit", "payment"] },
      { emoji: "🏧", label: "ATM", keywords: ["atm", "withdrawal", "cash point"] },
      { emoji: "🪙", label: "Coins", keywords: ["coins", "change", "small money"] },
      { emoji: "💱", label: "Exchange", keywords: ["exchange", "forex", "currency", "fx"] },
      { emoji: "📈", label: "Investment", keywords: ["investment", "stocks", "growth", "portfolio"] },
      { emoji: "📉", label: "Loss", keywords: ["loss", "decline", "downturn"] },
      { emoji: "💸", label: "Loan repayment", keywords: ["loan", "debt", "repayment", "owed", "instalment"] },
      { emoji: "🧾", label: "Bills", keywords: ["bill", "invoice", "receipt", "statement"] },
      { emoji: "🔁", label: "Transfers", keywords: ["transfer", "transfers", "send money", "move"] },
      { emoji: "🛡️", label: "Insurance", keywords: ["insurance", "cover", "policy", "premium"] },
      { emoji: "💎", label: "Crypto", keywords: ["crypto", "bitcoin", "digital assets", "tokens"] },
      { emoji: "📊", label: "Reports", keywords: ["analytics", "report", "data", "stats"] },
    ],
  },
  {
    id: "health",
    label: "Health",
    icons: [
      { emoji: "🏥", label: "Hospital", keywords: ["hospital", "clinic", "medical"] },
      { emoji: "⚕️", label: "Medical", keywords: ["medical", "health", "doctor", "consultation"] },
      { emoji: "🩺", label: "Check-up", keywords: ["checkup", "doctor", "diagnosis", "consultation"] },
      { emoji: "💊", label: "Pharmacy", keywords: ["pharmacy", "medicine", "drugs", "prescription"] },
      { emoji: "🩹", label: "First aid", keywords: ["first aid", "injury", "bandage"] },
      { emoji: "🦷", label: "Dental", keywords: ["dental", "dentist", "teeth"] },
      { emoji: "🚑", label: "Emergency", keywords: ["ambulance", "emergency", "urgent care"] },
      { emoji: "🧘", label: "Therapy", keywords: ["therapy", "wellness", "meditation", "mental health"] },
      { emoji: "🏋️", label: "Gym", keywords: ["gym", "workout", "fitness", "training"] },
      { emoji: "💪", label: "Fitness", keywords: ["fitness", "exercise", "strength"] },
      { emoji: "🧴", label: "Toiletries", keywords: ["lotion", "toiletries", "care", "supplies"] },
    ],
  },
  {
    id: "family",
    label: "Family & education",
    icons: [
      { emoji: "👶", label: "Childcare", keywords: ["baby", "childcare", "nursery", "creche"] },
      { emoji: "🍼", label: "Baby supplies", keywords: ["baby", "formula", "nappies", "supplies"] },
      { emoji: "🧸", label: "Kids", keywords: ["toys", "kids", "children", "play"] },
      { emoji: "🎓", label: "School fees", keywords: ["school", "tuition", "education", "fees", "studies"] },
      { emoji: "📚", label: "Books", keywords: ["books", "study", "library", "reading", "textbooks"] },
      { emoji: "🎒", label: "School supplies", keywords: ["school supplies", "backpack", "stationery"] },
      { emoji: "👨‍👩‍👧", label: "Family", keywords: ["family", "household", "dependants"] },
      { emoji: "🧑‍🦳", label: "Elderly care", keywords: ["elderly", "parents", "care", "upkeep"] },
      { emoji: "🐾", label: "Pets", keywords: ["pets", "vet", "dog", "cat", "animal"] },
    ],
  },
  {
    id: "lifestyle",
    label: "Lifestyle & shopping",
    icons: [
      { emoji: "🛍️", label: "Shopping", keywords: ["shopping", "retail", "bags", "spending"] },
      { emoji: "🏪", label: "Store", keywords: ["store", "shop", "market", "convenience"] },
      { emoji: "👕", label: "Clothing", keywords: ["clothes", "clothing", "fashion", "apparel"] },
      { emoji: "👟", label: "Shoes", keywords: ["shoes", "trainers", "footwear"] },
      { emoji: "👜", label: "Accessories", keywords: ["bag", "handbag", "accessories"] },
      { emoji: "🕶️", label: "Eyewear", keywords: ["glasses", "sunglasses", "eyewear", "optician"] },
      { emoji: "💇", label: "Hair", keywords: ["haircut", "barber", "hair", "salon"] },
      { emoji: "💅", label: "Beauty", keywords: ["beauty", "nails", "grooming", "spa"] },
      { emoji: "🎬", label: "Cinema", keywords: ["movie", "cinema", "film"] },
      { emoji: "🎮", label: "Gaming", keywords: ["games", "gaming", "console", "play"] },
      { emoji: "🎧", label: "Audio", keywords: ["headphones", "music", "podcasts", "audio"] },
      { emoji: "🎨", label: "Hobbies", keywords: ["hobby", "art", "craft", "creative"] },
      { emoji: "⚽", label: "Sport", keywords: ["sport", "football", "club", "match"] },
      { emoji: "🎲", label: "Games", keywords: ["dice", "board game", "betting"] },
      { emoji: "♟️", label: "Chess", keywords: ["chess", "strategy", "hobby"] },
      { emoji: "🎯", label: "Goals", keywords: ["target", "goal", "milestone"] },
      { emoji: "🎵", label: "Music note", keywords: ["music", "song", "track"] },
      { emoji: "🎶", label: "Songs", keywords: ["music", "songs", "playlist"] },
      { emoji: "🎼", label: "Sheet music", keywords: ["music", "score", "sheet", "lessons"] },
      { emoji: "🎤", label: "Microphone", keywords: ["mic", "karaoke", "singing", "recording"] },
      { emoji: "🎹", label: "Piano", keywords: ["piano", "keyboard", "instrument"] },
      { emoji: "🎸", label: "Guitar", keywords: ["guitar", "instrument", "strings"] },
      { emoji: "🎷", label: "Saxophone", keywords: ["saxophone", "jazz", "instrument"] },
      { emoji: "🎺", label: "Trumpet", keywords: ["trumpet", "brass", "instrument"] },
      { emoji: "🥁", label: "Drums", keywords: ["drums", "percussion", "instrument"] },
    ],
  },
  {
    id: "work",
    label: "Work & business",
    icons: [
      { emoji: "💼", label: "Business", keywords: ["business", "work", "professional", "expenses"] },
      { emoji: "💻", label: "Laptop", keywords: ["laptop", "computer", "software", "work"] },
      { emoji: "🖥️", label: "Desktop", keywords: ["computer", "desktop", "workstation"] },
      { emoji: "⌨️", label: "Keyboard", keywords: ["keyboard", "peripherals", "accessories"] },
      { emoji: "🖱️", label: "Mouse", keywords: ["mouse", "peripherals", "accessories"] },
      { emoji: "🖨️", label: "Printing", keywords: ["printer", "printing", "paper", "office"] },
      { emoji: "📎", label: "Office supplies", keywords: ["office", "stationery", "supplies", "paperclip"] },
      { emoji: "✏️", label: "Stationery", keywords: ["pen", "pencil", "stationery", "writing"] },
      { emoji: "📇", label: "Contacts", keywords: ["contacts", "clients", "directory"] },
      { emoji: "📅", label: "Scheduling", keywords: ["calendar", "schedule", "booking", "planning"] },
      { emoji: "📷", label: "Photography", keywords: ["camera", "photo", "photography", "shoot"] },
      { emoji: "📹", label: "Video", keywords: ["video", "recording", "filming", "production"] },
    ],
  },
  {
    id: "giving",
    label: "Giving",
    icons: [
      { emoji: "🎁", label: "Gifts", keywords: ["gift", "present", "birthday", "reward"] },
      { emoji: "🤝", label: "Charity", keywords: ["charity", "donation", "giving", "support"] },
      { emoji: "❤️", label: "Donations", keywords: ["donation", "giving", "cause", "support"] },
      { emoji: "🎗️", label: "Causes", keywords: ["cause", "awareness", "ribbon", "fundraiser"] },
      { emoji: "⛪", label: "Church", keywords: ["church", "tithe", "offering", "religious"] },
      { emoji: "🕌", label: "Mosque", keywords: ["mosque", "zakat", "offering", "religious"] },
      { emoji: "🕊️", label: "Faith", keywords: ["faith", "peace", "spiritual", "religious"] },
      { emoji: "🎉", label: "Celebrations", keywords: ["party", "celebration", "wedding", "event"] },
      { emoji: "🎂", label: "Birthday", keywords: ["birthday", "cake", "anniversary"] },
    ],
  },
  {
    id: "travel",
    label: "Travel",
    icons: [
      { emoji: "🧳", label: "Luggage", keywords: ["luggage", "suitcase", "packing", "trip"] },
      { emoji: "🏨", label: "Hotel", keywords: ["hotel", "accommodation", "lodging", "stay"] },
      { emoji: "🗺️", label: "Trips", keywords: ["trip", "map", "itinerary", "journey"] },
      { emoji: "🛂", label: "Visa", keywords: ["visa", "passport", "immigration", "travel docs"] },
      { emoji: "🏖️", label: "Holiday", keywords: ["beach", "vacation", "holiday", "summer"] },
      { emoji: "🏔️", label: "Mountains", keywords: ["mountain", "hiking", "outdoors"] },
      { emoji: "🏕️", label: "Camping", keywords: ["camping", "outdoors", "tent"] },
    ],
  },
  {
    id: "nature",
    label: "Nature & outdoors",
    icons: [
      { emoji: "🌿", label: "Plants", keywords: ["plant", "leaf", "garden", "eco"] },
      { emoji: "🌸", label: "Flowers", keywords: ["flower", "garden", "florist"] },
      { emoji: "🌲", label: "Trees", keywords: ["tree", "nature", "forest", "park"] },
      { emoji: "🦋", label: "Butterfly", keywords: ["butterfly", "nature", "garden"] },
      { emoji: "🐞", label: "Ladybug", keywords: ["ladybug", "nature", "garden"] },
      { emoji: "☀️", label: "Sunny", keywords: ["sun", "summer", "weather"] },
      { emoji: "🌧️", label: "Rain", keywords: ["rain", "weather", "wet season"] },
    ],
  },
  {
    id: "other",
    label: "Other",
    icons: [
      { emoji: "📦", label: "Miscellaneous", keywords: ["misc", "miscellaneous", "other", "general", "unsorted"] },
      { emoji: "🗂️", label: "Folder", keywords: ["folder", "category", "group", "filing"] },
      { emoji: "🔖", label: "Label", keywords: ["label", "tag", "bookmark"] },
      { emoji: "⭐", label: "Starred", keywords: ["star", "favourite", "priority", "important"] },
      { emoji: "❓", label: "Unknown", keywords: ["unknown", "unsorted", "to review", "question"] },
      { emoji: "➕", label: "Extra", keywords: ["extra", "additional", "new", "other"] },
      { emoji: "🔔", label: "Reminders", keywords: ["reminder", "alert", "notification", "due"] },
      { emoji: "📌", label: "Pinned", keywords: ["pinned", "pin", "important", "note"] },
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