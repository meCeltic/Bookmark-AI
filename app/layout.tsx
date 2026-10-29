import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Bookmark-AI",
  description: "Save a page, get it back with one word.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
