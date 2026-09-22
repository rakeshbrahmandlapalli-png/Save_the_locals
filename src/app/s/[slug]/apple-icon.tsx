import { ImageResponse } from "next/og";
import { createPublicClient } from "@/lib/supabase";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createPublicClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("name,brand")
    .eq("slug", slug)
    .maybeSingle<{ name: string; brand: { primary_colour?: string } | null }>();

  const letter = (shop?.name ?? "S").trim().charAt(0).toUpperCase();
  const colour = shop?.brand?.primary_colour || "#285943";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colour,
          color: "#ffffff",
          fontSize: 100,
          fontWeight: 700,
        }}
      >
        {letter}
      </div>
    ),
    { ...size },
  );
}
