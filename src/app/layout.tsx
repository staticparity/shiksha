import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shiksha — The AI That Refuses to Teach",
  description:
    "Learn by teaching AI. Students explain concepts to a curious AI learner. Understanding gets measured, not memorization. The Feynman Method meets dual-agent AI.",
  keywords: [
    "shiksha",
    "learn by teaching",
    "feynman method",
    "AI education",
    "mastery learning",
    "active learning",
    "K-12 edtech",
  ],
  authors: [{ name: "Shiksha" }],
  openGraph: {
    title: "Shiksha — The AI That Refuses to Teach",
    description:
      "Students explain. AI questions. Understanding gets measured.",
    type: "website",
    locale: "en_IN",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
