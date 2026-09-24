import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase";
import { Storefront } from "./storefront";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createPublicClient();
  const { data: shop } = await supabase.from("shops").select("name").eq("slug", slug).eq("active", true).maybeSingle<{ name: string }>();
  const name = shop?.name ?? "Save the Locals";
  return {
    title: name,
    manifest: `/s/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, statusBarStyle: "default", title: name },
  };
}

export type Shop = {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  min_order: number;
  delivery_fee: number;
  delivery_radius_km: number;
  brand: { primary_colour?: string; logo_url?: string | null } | null;
};

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  sort: number;
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  unit: string;
  price: number;
  image_url: string | null;
  in_stock: boolean;
  sort: number;
};

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ src?: string | string[] }>;
}) {
  const { slug } = await params;
  const { src } = await searchParams;
  const initialSource = (Array.isArray(src) ? src[0] : src)?.trim() || null;
  const supabase = createPublicClient();

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("id,slug,name,address,min_order,delivery_fee,delivery_radius_km,brand")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle<Shop>();

  if (shopError) throw new Error(`Unable to load shop: ${shopError.message}`);
  if (!shop) notFound();

  const [categoryResult, productResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id,name,icon,sort")
      .eq("shop_id", shop.id)
      .order("sort")
      .returns<Category[]>(),
    supabase
      .from("products")
      .select("id,category_id,name,unit,price,image_url,in_stock,sort")
      .eq("shop_id", shop.id)
      .eq("active", true)
      .order("sort")
      .returns<Product[]>(),
  ]);

  if (categoryResult.error) throw new Error(`Unable to load categories: ${categoryResult.error.message}`);
  if (productResult.error) throw new Error(`Unable to load products: ${productResult.error.message}`);

  return (
    <Storefront
      shop={shop}
      categories={categoryResult.data}
      products={productResult.data}
      initialSource={initialSource}
    />
  );
}
