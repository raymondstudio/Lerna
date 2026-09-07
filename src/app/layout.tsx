import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";
import "./globals.css";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: {
    default: "Lerna AI | Smart Learning & AI Tutoring",
    template: "%s | Lerna AI"
  },
  description: "The most intuitive AI tutoring platform built for actual studying. Ask questions, upload PDFs, and build smart revision plans.",
  keywords: ["AI tutor", "Lerna", "smart learning", "study app", "AI education", "PDF learning", "revision plans", "AI study buddy"],
  authors: [{ name: "Raymond Iorliam" }],
  creator: "Raymond Iorliam",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://learn.app",
    title: "Lerna AI | Learn smarter, not harder",
    description: "Experience the most intuitive AI tutoring platform built for actual studying. Upload your lecture materials and get instant, structured guidance.",
    siteName: "Lerna AI",
    images: [
      {
        url: "public/assets/dashboard-mockup.png",
        width: 1200,
        height: 630,
        alt: "Lerna Dashboard Mockup",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lerna AI | Smart Learning & AI Tutoring",
    description: "Experience the most intuitive AI tutoring platform built for actual studying.",
    images: ["/public/assets/dashboard-mockup.png"],
    creator: "@RaymondIorliam",
  },
  alternates: {
    canonical: "https://learn.app",
  },
  verification: {
    google: "B2jCJ9T6mDH8KwKS6o8N95Xaya6ucc_L95i0Elo8bnI",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createSupabaseServerClient();
  let initialSession = null;

  try {
    const { data } = await supabase.auth.getSession();
    initialSession = data.session;
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
