import type { NextConfig } from "next";

const FASTAPI_URL = process.env.FASTAPI_INTERNAL_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: "",
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${FASTAPI_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
