import {
  Apple,
  Baby,
  Coffee,
  Cookie,
  Croissant,
  Droplet,
  Flame,
  IceCreamCone,
  Milk,
  NotebookPen,
  ShoppingBasket,
  ShowerHead,
  SprayCan,
  Wheat,
  WashingMachine,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  general: ShoppingBasket,
  wheat: Wheat,
  dairy: Milk,
  oil: Droplet,
  spices: Flame,
  snacks: Cookie,
  beverages: Coffee,
  bakery: Croissant,
  produce: Apple,
  personal_care: ShowerHead,
  home_care: SprayCan,
  laundry: WashingMachine,
  baby: Baby,
  stationery: NotebookPen,
  frozen: IceCreamCone,
};

export const CATEGORY_ICON_OPTIONS: { key: string; label: string }[] = [
  { key: "general", label: "General" },
  { key: "wheat", label: "Rice, Atta & Grains" },
  { key: "dairy", label: "Dairy" },
  { key: "oil", label: "Oil & Ghee" },
  { key: "spices", label: "Spices & Masala" },
  { key: "snacks", label: "Snacks" },
  { key: "beverages", label: "Tea, Coffee & Drinks" },
  { key: "bakery", label: "Bakery & Biscuits" },
  { key: "produce", label: "Fruits & Vegetables" },
  { key: "personal_care", label: "Personal Care" },
  { key: "home_care", label: "Home Care & Cleaning" },
  { key: "laundry", label: "Laundry" },
  { key: "baby", label: "Baby Care" },
  { key: "stationery", label: "Stationery" },
  { key: "frozen", label: "Frozen & Ice Cream" },
];

export function CategoryIcon({ icon, className }: { icon: string | null; className?: string }) {
  const Icon = (icon && CATEGORY_ICONS[icon]) || CATEGORY_ICONS.general;
  return <Icon className={className} aria-hidden="true" />;
}
