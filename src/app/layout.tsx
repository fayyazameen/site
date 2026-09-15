import { Analytics } from "@vercel/analytics/react";
import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import AmbientArt from "@/components/AmbientArt";
import AmbientSceneProvider from "@/components/ambient/AmbientSceneProvider";
import ContentWrapper from "@/components/ContentWrapper";
import BackButton from "@/components/BackButton";

export const metadata: Metadata = {
  // Placeholder — set this to your real domain before launch.
  metadataBase: new URL("https://your-domain.com"),
  title: "fayyaz ameen",
  description: "placeholder — one line about what you do.",
  openGraph: {
    title: "fayyaz ameen",
    description: "placeholder — one line about what you do.",
  },
  twitter: {
    card: "summary",
    title: "fayyaz ameen",
    description: "placeholder — one line about what you do.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AmbientSceneProvider>
          <main className="firefox-scrollbar-fix min-h-screen">
            <ContentWrapper>
              <BackButton />
              {children}
              <AmbientArt variant="bottom" />
            </ContentWrapper>
          </main>
          <AmbientArt />
        </AmbientSceneProvider>
        <Analytics />
      </body>
    </html>
  );
}
