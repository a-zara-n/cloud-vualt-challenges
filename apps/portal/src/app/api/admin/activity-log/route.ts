import { NextRequest, NextResponse } from "next/server";
import { requireAdminPayload } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const result = await requireAdminPayload(req);
  if (result.error) return result.error;

  const stage = process.env.CTF_STAGE ?? "prod";
  const stageScopedName = (baseName: string) =>
    stage === "prod" ? baseName : `${baseName}-${stage}`;
  const ctoUserName = stageScopedName("cto-kawakami");
  const ctoBackupKeySecretName = stageScopedName("tvault/cto/backup-key");

  const entries = [
    {
      user: ctoUserName,
      action: "CreateBucket",
      detail: "bucket: tvault-cto-private-7a3f9c",
      timestamp: "2026-02-01T23:01:55Z",
    },
    {
      user: ctoUserName,
      action: "AccessSecret",
      detail: `secret: ${ctoBackupKeySecretName}`,
      timestamp: "2026-02-02T01:22:11Z",
    },
    {
      user: ctoUserName,
      action: "PutObject",
      detail: "key: cto-evidence/final_complicity.txt",
      timestamp: "2026-02-02T01:23:45Z",
    },
  ];

  return NextResponse.json({
    entries,
    activity: entries,
  });
}
