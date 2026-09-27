import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { handler } from "../apps/infra/lambda/challenge-server/index.mjs";

const dashboardPort = Number(process.env.PORT ?? "3001");
const targetPort = Number(process.env.TARGET_PORT ?? "3002");
const flag = process.env.CLOUD_VAULT_CTF_FLAG ?? "TVAULT{cloud_security_matters_always}";
const dashboardPassword =
  process.env.CLOUD_VAULT_DASHBOARD_PASSWORD ?? "vault-ctf-2026";

process.env.CTF_STAGE ??= "local";
process.env.CTF_EVENT_NAME ??= process.env.CLOUD_VAULT_CTF_EVENT_NAME ?? "Cloud Vault CTF";
process.env.CTF_CHALLENGE_ID ??= process.env.CLOUD_VAULT_CTF_CHALLENGE_ID ?? "cloud-vault";
process.env.CTF_CHALLENGE_TITLE ??=
  process.env.CLOUD_VAULT_CTF_TITLE ?? "Cloud Vault — TechVault不正アクセス調査";
process.env.CTF_CHALLENGE_DESCRIPTION ??=
  process.env.CLOUD_VAULT_CTF_DESCRIPTION ??
  "TechVault社で発生した不正アクセスを調査し、最終証拠に記録されたフラグを提出してください。";
process.env.CTF_CHALLENGE_CATEGORY ??=
  process.env.CLOUD_VAULT_CTF_CATEGORY ?? "Cloud / AWS";
process.env.CTF_CHALLENGE_POINTS ??= process.env.CLOUD_VAULT_CTF_POINTS ?? "500";
process.env.CTF_CHALLENGE_DIFFICULTY ??=
  process.env.CLOUD_VAULT_CTF_DIFFICULTY ?? "Beginner";
process.env.CTF_HINTS_JSON ??=
  process.env.CLOUD_VAULT_CTF_HINTS_JSON ??
  JSON.stringify(["robots.txt を確認してください。", "AWS認証情報の権限を調査してください。"]);
process.env.CTF_TARGET_URL ??=
  process.env.CLOUD_VAULT_CTF_TARGET_URL?.trim() || `http://localhost:${targetPort}`;
process.env.CTF_FLAG_SHA256 ??= createHash("sha256").update(flag).digest("hex");
process.env.CTF_BASIC_AUTH_USERNAME ??=
  process.env.CLOUD_VAULT_DASHBOARD_USERNAME ?? "cloudvault";
process.env.CTF_BASIC_AUTH_PASSWORD_SHA256 ??= createHash("sha256")
  .update(dashboardPassword)
  .digest("hex");
process.env.CTF_CHALLENGES_PATH ??= resolve(
  import.meta.dir,
  "../season/Cloud-Vault/challenges.json",
);

function createServer(port: number, appMode: "dashboard" | "target") {
  return Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const body = request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();
    const result = await handler({
      appMode,
      rawPath: url.pathname,
      requestContext: { http: { method: request.method } },
      headers: Object.fromEntries(request.headers),
      body,
      isBase64Encoded: false,
    });

    return new Response(result.body, {
      status: result.statusCode,
      headers: result.headers,
    });
  },
});
}

const dashboard = createServer(dashboardPort, "dashboard");
const target = createServer(targetPort, "target");
console.log(`[dashboard] http://localhost:${dashboard.port}`);
console.log(`[problem]   http://localhost:${target.port}`);
