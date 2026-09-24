/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static HTML/CSS/JS for S3 (or any static host). `next build` writes to `out/`.
  output: 'export',
  // Emit `/route/index.html` so S3 can serve directory URLs without rewrite rules.
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
