import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const metadataBase = publicAppUrl ? new URL(publicAppUrl) : undefined;

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  title: "Nota - Next-Gen Markdown & Knowledge Hub",
  description: "Next-generation Markdown reading, visualization, and knowledge management platform.",
  ...(metadataBase
    ? {
        icons: {
          icon: [
            { url: "/favicon.ico", sizes: "any" },
            { url: "/logo.png", type: "image/png" },
          ],
          shortcut: "/favicon.ico",
          apple: "/apple-touch-icon.png",
        },
      }
    : {}),
  openGraph: {
    title: "Nota - Next-Gen Markdown & Knowledge Hub",
    description: "Next-generation Markdown reading, visualization, and knowledge management platform.",
    ...(metadataBase
      ? { images: [{ url: "/logo.png", width: 50, height: 50, alt: "Nota Logo" }] }
      : {}),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="h-full antialiased dark">
      <body className="h-full bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
        {children}
        <footer className="sr-only">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/support">Support</Link>
        </footer>
      </body>
    </html>
  );
}
