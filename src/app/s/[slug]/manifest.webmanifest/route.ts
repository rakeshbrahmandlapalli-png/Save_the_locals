import { storefrontName, storefrontColour } from "@/lib/store-brand";
import { createPublicClient } from "@/lib/supabase";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createPublicClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("name,brand")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle<{ name: string; brand: { primary_colour?: string; logo_url?: string | null } | null }>();

  const name = storefrontName(shop?.name ?? "Nextdoor Basket");
  const themeColour = storefrontColour(shop?.name ?? "", shop?.brand?.primary_colour);
  const iconUrl = shop?.brand?.logo_url || `/s/${slug}/icon`;

  const manifest = {
    name,
    short_name: name.slice(0, 24),
    start_url: `/s/${slug}`,
    scope: `/s/${slug}`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: themeColour,
    icons: [
      { src: iconUrl, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: iconUrl, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };

  return Response.json(manifest, { headers: { "Cache-Control": "public, max-age=600" } });
}
