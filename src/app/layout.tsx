import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JWF Bursary System",
  description: "John Whitgift Foundation — Bursary Assessment System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
