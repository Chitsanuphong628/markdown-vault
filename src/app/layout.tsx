import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Markdown Vault - สวยงาม อ่านง่าย จัดการสะดวก",
  description: "เว็บจัดเก็บและอ่านโน้ต Markdown พร้อม Table of Contents และระบบโฟลเดอร์",
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
