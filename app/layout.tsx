import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import { PrintModeManager } from "@/components/PrintModeManager";
import { config, siteUrl } from "@/lib/config";
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
  metadataBase: new URL(siteUrl()),
  title: {
    default: title,
    template: `%s · ${config.appName}`,
  },
  description: config.description,
  openGraph: {
    title,
    description: config.description,
    siteName: config.appName,
    images: ["/og"],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: config.description,
    images: ["/og"],
  },
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
