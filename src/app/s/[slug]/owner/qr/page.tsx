import { QrConsole } from "./qr-console";

export default async function QrPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <QrConsole slug={slug} />;
}
