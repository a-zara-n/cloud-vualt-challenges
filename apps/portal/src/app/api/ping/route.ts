import { NextResponse } from "next/server";

// T4: X-Internal-Flag ヘッダーを含むエンドポイント
// next.config.ts の headers() 設定でヘッダーを追加している
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
