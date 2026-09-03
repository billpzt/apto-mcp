import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const BASE_URL = process.env.APTO_BASE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "Apto — Career Dashboard",
  description: "Your personal job search command center",
  openGraph: {
    type: "website",
    url: BASE_URL,
    siteName: "Apto",
    title: "Apto — Career Dashboard",
    description: "Your personal job search command center",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "Apto" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Apto — Career Dashboard",
    description: "Your personal job search command center",
    images: ["/og-default.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
