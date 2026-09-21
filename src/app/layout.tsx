import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Save the Locals",
  description: "Online ordering for neighbourhood shops",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
