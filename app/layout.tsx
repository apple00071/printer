import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScanPrint Kiosk - Self-Service Printing",
  description: "Upload, pay via UPI, and print your documents instantly.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
