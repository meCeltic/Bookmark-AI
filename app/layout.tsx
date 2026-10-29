import type { Metadata, Viewport } from "next"
import { Fraunces, JetBrains_Mono, Source_Sans_3 } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { Toaster } from "sonner"
import "./globals.css"

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "WONK", "SOFT"],
  style: ["normal", "italic"],
  display: "swap",
})
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  weight: ["400", "600"],
  display: "swap",
})
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
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
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#141311" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${sourceSans.variable} ${jetbrains.variable}`}
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              unstyled: true,
              classNames: {
                toast:
                  "card flex items-center gap-3 px-4 py-3 text-sm font-sans w-[360px] max-w-[calc(100vw-32px)] shadow-card",
                title: "font-semibold",
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
