import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "Save the Locals",
  description: "Online ordering for neighbourhood shops",
};

// viewport-fit=cover lets the fixed bottom bars respect the device safe area (env(safe-area-inset-*)).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.className} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
