import { NextRequest, NextResponse } from "next/server";
import { requireAdminPayload } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const result = await requireAdminPayload(req);
  if (result.error) return result.error;

  return NextResponse.json({
    flag: "TVAULT{cognito_custom_attribute_abuse}",
  });
}
