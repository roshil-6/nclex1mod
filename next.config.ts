import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Question-bank JSON is read from disk at runtime by server code only.
  outputFileTracingIncludes: { "/**": ["./data/**/*.json"] },
  outputFileTracingExcludes: { "/**": ["./source/**"] },
};
export default nextConfig;
