import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "BookmarkAI - Save and organize your bookmarks with AI",
  description: "BookmarkAI helps you save, organize, and summarize your favorite websites.",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} dark:bg-gray-900 dark:text-gray-100`}>{children}</body>
    </html>
  )
}
