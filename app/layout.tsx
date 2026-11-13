import type { Metadata, Viewport } from "next"
import { Newsreader, Schibsted_Grotesk } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Toaster } from "sonner"
import "./globals.css"

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  weight: ["400", "500", "600", "700", "900"],
  display: "swap",
})
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["italic"],
  weight: ["400", "500"],
  display: "swap",
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Bookmark-AI", template: "%s · Bookmark-AI" },
  description: "Save a page, get it back with one word. Bookmarks with AI-written summaries, tags, collections and search.",
  openGraph: {
    title: "Bookmark-AI",
    description: "Save a page, get it back with one word.",
    type: "website",
    url: siteUrl,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f11" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${schibsted.variable} ${newsreader.variable}`}
    >
      {/* Extensions (ColorZilla, Grammarly) add attributes to body before React loads. */}
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              unstyled: true,
              classNames: {
                toast:
                  "pop anim-rise flex items-center gap-3 px-4 py-3 text-sm font-sans w-[380px] max-w-[calc(100vw-32px)]",
                title: "font-medium",
                description: "text-ink-2",
                actionButton: "btn btn-sm ml-auto",
                cancelButton: "btn btn-sm btn-ghost",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
