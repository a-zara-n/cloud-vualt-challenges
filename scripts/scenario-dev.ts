import { AWS_REGION, DEV_STAGE, stackOutput } from "./_aws-dev";
import { runCommand } from "./_helpers";

async function main(): Promise<void> {
  const forwardedArgs = process.argv.slice(2);
  const portalUrl =
    process.env.CTF_PORTAL_URL ??
    process.env.TVAULT_PORTAL_URL ??
    (await stackOutput(`ctf-portal-frontend-${DEV_STAGE}`, "PortalUrl"));
  const vectorBucketName =
    process.env.CTF_S3_VECTORS_BUCKET ??
    (await stackOutput(`ctf-bedrock-${DEV_STAGE}`, "TechVaultVaultVectorBucketName"));
  const vectorIndexName =
    process.env.CTF_S3_VECTORS_INDEX ??
    (await stackOutput(`ctf-bedrock-${DEV_STAGE}`, "TechVaultVaultVectorIndexName"));
  await runCommand(
    "scenario solver dev",
    ["bun", "run", "solve", "--target", "dev", ...forwardedArgs],
    {
      cwd: "scenario/solver",
      env: {
        AWS_REGION,
        CTF_STAGE: DEV_STAGE,
        CTF_SOLVER_TARGET: "dev",
        CTF_PORTAL_URL: portalUrl,
        TVAULT_PORTAL_URL: portalUrl,
        CTF_S3_VECTORS_BUCKET: vectorBucketName,
        CTF_S3_VECTORS_INDEX: vectorIndexName,
        API_MASTER_KEY:
          process.env.API_MASTER_KEY ?? "tvault-master-3D-layer-secret-key-2026",
      },
    }
  );
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error ? `[scenario:dev] ${error.message}` : "[scenario:dev] failed"
  );
  process.exit(1);
}
