import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import { PrintModeManager } from "@/components/PrintModeManager";
import { config } from "@/lib/config";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const title = `${config.appName} — ${config.tagline}`;

export const metadata: Metadata = {
  title: {
    default: title,
    template: `%s · ${config.appName}`,
  },
  description: config.description,
  // A local tool: keep it out of search engines if someone exposes it.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} ${newsreader.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <PrintModeManager />
        {children}
      </body>
    </html>
  );
}
