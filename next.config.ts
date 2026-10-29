import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Favicons and OG images are hot-linked from the bookmarked sites, so any host is allowed.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
}

export default nextConfig
