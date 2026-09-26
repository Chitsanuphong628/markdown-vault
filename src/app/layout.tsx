import type { Metadata, Viewport } from "next";
import Link from "next/link";
import PwaServiceWorker from "@/components/PwaServiceWorker";
import "./globals.css";

const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const metadataBase = publicAppUrl ? new URL(publicAppUrl) : undefined;

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  title: "Nota · Notes",
  description: "Write, organize, and search notes. Edit Markdown whenever you need it.",
  applicationName: "Nota",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Nota",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "Nota · Notes",
    description: "Write, organize, and search notes. Edit Markdown whenever you need it.",
    ...(metadataBase
      ? { images: [{ url: "/logo.png", width: 50, height: 50, alt: "Nota Logo" }] }
      : {}),
  },
};

export const viewport: Viewport = {
  themeColor: "#090a0f",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className="h-full antialiased dark">
      <body className="h-full bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
        <PwaServiceWorker />
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
