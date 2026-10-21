import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import { PRIVACY_BOOT_SCRIPT } from "@/features/privacy/config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Kestrel EHR (synthetic prototype)",
  description: "Clinician workspace prototype using synthetic data only. Not for clinical use.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the Privacy mode script may add data-privacy to <html> before hydration.
    <html lang="en" className={`${inter.variable} ${plexMono.variable} ${fraunces.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRIVACY_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
