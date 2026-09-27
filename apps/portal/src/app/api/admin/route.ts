import { NextRequest, NextResponse } from "next/server";
import { requireAdminPayload } from "@/lib/admin-auth";

// ★ Stage 3C 脆弱性: custom:role === 'admin' のみで管理者判定
// Cognitoのカスタム属性はデフォルトでユーザーが自分で変更できる（mutable: true）
// 攻撃者は自分でユーザーを作成し、custom:role='admin' を設定すればこのAPIにアクセスできる
export async function GET(req: NextRequest) {
  const result = await requireAdminPayload(req);
  if (result.error) return result.error;

  // 管理者のみアクセスできる機密情報
  return NextResponse.json({
    message: "Welcome to the admin panel",
    flag: "TVAULT{cognito_custom_attribute_abuse}",
    internalData: {
      dbConnectionString:
        "mysql://app_user:Pr0duction_DB_Pass!@internal-db.techvault.local/techvault_prod",
      s3InternalBucket: "techvault-internal-2026",
      adminUsers: ["ceo@techvault.example", "cfo@techvault.example"],
    },
  });
}
