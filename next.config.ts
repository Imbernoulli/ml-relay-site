import type { NextConfig } from "next";

// Static export. The internal site is built and served locally; the public
// site (GitHub Pages under /<repo>) sets NEXT_BASE_PATH at build time.
const basePath = process.env.NEXT_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
