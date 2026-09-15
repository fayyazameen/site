/** @type {import('next').NextConfig} */
const staticPreview = process.env.SITES_STATIC_EXPORT === "1";

const nextConfig = {
  // Keep the running preview separate from production build artifacts.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  ...(staticPreview ? { output: "export" } : {}),
  images: {
    ...(staticPreview ? { unoptimized: true } : {}),
    domains: ["api.microlink.io"],
  },
};

export default nextConfig;
