import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { InlineScript } from "@/components/ui/InlineScript";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Budget Planner",
    template: "%s · Budget Planner",
  },
  description: "A client-side personal budget planner.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        {/* Runs synchronously while the browser parses the HTML (before first
            paint), so the saved theme/accent is applied with no flash. The
            type switch keeps React from treating it as an executable script in
            the client tree (see components/ui/InlineScript.tsx). */}
        <InlineScript html={THEME_BOOTSTRAP_SCRIPT} />
      </head>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
