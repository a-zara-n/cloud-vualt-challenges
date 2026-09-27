import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  // T4: X-Internal-Flag ヘッダーをレスポンスに追加（/api/ping用）
  async headers() {
    return [
      {
        source: "/api/ping",
        headers: [
          {
            key: "X-Internal-Flag",
            value: "TVAULT{curl_headers_revealed}",
          },
          {
            key: "X-Debug-Info",
            value: "build=2026.03.15",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
