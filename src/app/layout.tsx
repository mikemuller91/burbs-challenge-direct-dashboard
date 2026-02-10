import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Burbs February Challenge",
  description: "Track the progress of the Burbs February Challenge",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
