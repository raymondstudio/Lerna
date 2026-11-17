import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";
import "./globals.css";

const headingFont = localFont({
  src: [
    { path: "./fonts/InstrumentSerif-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/InstrumentSerif-Italic.ttf", weight: "400", style: "italic" },
  ],
  display: "swap",
  variable: "--font-heading",
});

const bodyFont = localFont({
  src: "./fonts/space-grotesk-latin-wght-normal.woff2",
  weight: "300 700",
  display: "swap",
  variable: "--font-body",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.uselerna.app"),
  title: {
    default: "Lerna AI | Understand your materials. Keep what you learn.",
    template: "%s | Lerna AI"
  },
  description: "Ask questions about your learning materials, save notes with study sessions, and reopen your work when you are ready to continue.",
  keywords: ["AI tutor", "Lerna", "smart learning", "study app", "AI education", "PDF learning", "revision plans", "AI study buddy"],
  authors: [{ name: "Raymond Iorliam" }],
  creator: "Raymond Iorliam",
  icons: {
    icon: "/assets/lerna-logo-white-big.png",
    shortcut: "/assets/lerna-logo-white-big.png",
    apple: "/assets/lerna-logo-white-big.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.uselerna.app",
    title: "Lerna AI | Understand your materials. Keep what you learn.",
    description: "Ask questions about your learning materials and keep notes with your study sessions.",
    siteName: "Lerna AI",
    images: [
      {
        url: "/dashboard-mockup.png",
        width: 2914,
        height: 1736,
        alt: "Lerna study workspace preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lerna AI | Understand your materials. Keep what you learn.",
    description: "Ask questions about your learning materials and keep notes with your study sessions.",
    images: ["/dashboard-mockup.png"],
  },
  alternates: {
    canonical: "https://www.uselerna.app",
  },
  verification: {
    google: "fxKf0VEAWV9KMXuOj1YU-itMeDVSiFQyFJjq6gzozVw",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  let initialSession = null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.auth.getSession();
      initialSession = data.session;
    }
  } catch (error) {
    console.warn("[layout] failed to restore initial session", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className={`${headingFont.variable} ${bodyFont.variable} min-h-screen overflow-x-hidden bg-background font-body text-foreground antialiased`}>
        <Providers initialSession={initialSession}>{children}</Providers>
      </body>
    </html>
  );
}
