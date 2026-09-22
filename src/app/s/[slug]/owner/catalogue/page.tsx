import { CatalogueConsole } from "./catalogue-console";

export default async function CataloguePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CatalogueConsole slug={slug} />;
}
