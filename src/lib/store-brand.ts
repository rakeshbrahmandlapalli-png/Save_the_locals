/** Platform identity; each real shop keeps its own name and configured colour. */
export const PLATFORM_NAME = "Nextdoor Basket";
export function storefrontName(name: string) {
  return /^placeholder\b/i.test(name) ? PLATFORM_NAME : name;
}
export function storefrontColour(name: string, colour?: string) {
  return /^placeholder\b/i.test(name) ? "#27834a" : colour || "#27834a";
}
