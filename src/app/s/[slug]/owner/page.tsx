import { OwnerConsole } from "./owner-console";

export default async function OwnerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <OwnerConsole slug={slug} />;
}
