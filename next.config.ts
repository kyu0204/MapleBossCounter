import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3, node-cron 은 Next 기본 외부 패키지 목록에 있지만 명시해 둔다.
  serverExternalPackages: ["better-sqlite3", "node-cron"],
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "open.api.nexon.com" }],
  },
};

export default nextConfig;
