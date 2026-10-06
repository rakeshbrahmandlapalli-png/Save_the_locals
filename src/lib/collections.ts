// Shopping collections derived only from the shop's real inventory: product names and prices.
// A collection appears only when enough in-stock products match it, so a small catalogue is never
// padded with empty or one-item sections.

export type Accent = "sage" | "clay" | "mustard" | "slate";

export type CollectionProduct = { id: string; name: string; price: number; in_stock: boolean; category_id: string | null };

export type Collection = { id: string; title: string; accent: Accent; productIds: string[] };

type Rule = { id: string; title: string; accent: Accent; matches: (product: CollectionProduct) => boolean };

const RULES: Rule[] = [
  {
    id: "breakfast",
    title: "Breakfast & tea",
    accent: "mustard",
    matches: (p) => /\b(milk|tea|coffee|butter|bread|biscuits?|curd|jam|eggs?|oats|cereal|rusk|honey)\b/i.test(p.name),
  },
  {
    id: "cooking",
    title: "Cooking basics",
    accent: "clay",
    matches: (p) => /\b(rice|dal|atta|flour|oil|salt|ghee|sugar|masala|besan|rava|sooji|jaggery)\b/i.test(p.name),
  },
  {
    id: "under-50",
    title: "Under ₹50",
    accent: "slate",
    matches: (p) => p.price <= 50,
  },
];

export const MIN_COLLECTION_SIZE = 3;

export function deriveCollections(products: CollectionProduct[]): Collection[] {
  return RULES.map((rule) => ({
    id: rule.id,
    title: rule.title,
    accent: rule.accent,
    productIds: products.filter((product) => product.in_stock && rule.matches(product)).map((product) => product.id),
  })).filter((collection) => collection.productIds.length >= MIN_COLLECTION_SIZE);
}

const AISLE_ACCENTS: Accent[] = ["sage", "clay", "mustard", "slate"];

/** Aisles cycle through the four muted accents in their display order. */
export function aisleAccent(index: number): Accent {
  return AISLE_ACCENTS[index % AISLE_ACCENTS.length];
}

export function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "") || "aisle";
}
