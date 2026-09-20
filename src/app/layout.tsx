import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nota - Next-Gen Markdown & Knowledge Hub",
  description: "Next-generation Markdown reading, visualization, and knowledge management platform.",
  icons: {
    icon: "/logo.png",
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
      </body>
    </html>
  );
}
