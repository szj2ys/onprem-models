import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "AMD OnPrem free models, live",
  description:
    "Every free AI model on AMD's internal OnPrem gateway: chat, embedding and decision models, with context windows, capacity and 7-day usage.",
  isAccessibleForFree: true,
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AMD OnPrem free models, live",
  description:
    "Every free AI model on AMD's internal OnPrem gateway: chat, embedding and decision models, context windows, capacity and 7-day usage, refreshed in real time.",
  openGraph: {
    title: "AMD OnPrem free models, live",
    description:
      "Every free model on the internal gateway: chat, embedding and decision models, with context windows and usage.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "AMD OnPrem free models dashboard" }],
  },
  alternates: { canonical: "./" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          // JSON-LD structured data for answer engines; static content, no secrets.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
