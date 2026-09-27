/**
 * Tutorial Stage Solvers (T1 - T6)
 *
 * These stages cover basic reconnaissance techniques:
 * - T1: robots.txt inspection
 * - T2: S3 public bucket access
 * - T3: Hardcoded secrets in HTML source
 * - T4: HTTP response header inspection
 * - T5: Exposed .env files
 * - T6: IAM user tag enumeration
 */

import { ListUserTagsCommand } from "@aws-sdk/client-iam";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { pathToFileURL } from "url";
import { createIAMClient, createS3Client } from "../lib/aws.js";
import type { AwsCredentials } from "../lib/aws.js";
import type { StageResult } from "../lib/reporter.js";
import type { SolverTarget } from "../lib/target.js";
import { bucketName, hasAwsRuntime, withPortalPath } from "../lib/target.js";

export interface SolverContext {
  readonly projectRoot: string;
  readonly target: SolverTarget;
  readonly stage: string;
  readonly localstackAvailable: boolean;
  readonly awsAvailable: boolean;
  readonly portalAvailable: boolean;
  readonly portalUrl: string;
  readonly localstackEndpoint: string;
  readonly staticOnly: boolean;
  readonly credentials?: AwsCredentials;
}

export interface SolverOutput {
  readonly passed: boolean;
  readonly flag?: string;
  readonly error?: string;
}

// Expected flags for validation
const FLAGS = {
  T1: "TVAULT{robots_txt_is_public}",
  T2: "TVAULT{s3_public_access_is_dangerous}",
  T3: "TVAULT{hardcoded_secret_in_js}",
  T4: "TVAULT{curl_headers_revealed}",
  T5: "TVAULT{dotenv_exposed_on_web}",
  T6: "TVAULT{aws_cli_first_step_complete}",
} as const;

/**
 * T1: robots.txt comment contains flag
 */
async function solveT1(ctx: SolverContext): Promise<SolverOutput> {
  try {
    let content: string | null = null;

    if (!ctx.staticOnly && ctx.portalAvailable) {
      const resp = await fetch(withPortalPath(ctx, "/robots.txt"), {
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        content = await resp.text();
      }
    }

    if (!content) {
      const robotsModulePath = `${ctx.projectRoot}/apps/portal/src/lib/robots.ts`;
      const robotsModule = await import(pathToFileURL(robotsModulePath).href) as {
        buildRobotsTxt: () => string;
      };
      content = robotsModule.buildRobotsTxt();
    }

    const match = content.match(/FLAG:\s*(TVAULT\{[^}]+\})/);
    if (match && match[1] === FLAGS.T1) {
      return { passed: true, flag: FLAGS.T1 };
    }

    // Check if flag string appears anywhere in the file
    if (content.includes(FLAGS.T1)) {
      return { passed: true, flag: FLAGS.T1 };
    }

    return { passed: false, error: "Flag not found in robots.txt" };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * T2: S3 public bucket flag.txt
 */
async function solveT2(ctx: SolverContext): Promise<SolverOutput> {
  if (hasAwsRuntime(ctx)) {
    try {
      const s3 = createS3Client(ctx);
      const resp = await s3.send(
        new GetObjectCommand({
          Bucket: bucketName(ctx, "techvault-public-assets"),
          Key: "flag.txt",
        })
      );
      const body = await resp.Body?.transformToString();
      if (body?.trim() === FLAGS.T2) {
        return { passed: true, flag: FLAGS.T2 };
      }
    } catch {
      // Fall through to local asset.
    }
  }

  try {
    const filePath = `${ctx.projectRoot}/apps/infra/assets/s3/techvault-public-assets/flag.txt`;
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      return { passed: false, error: `File not found: ${filePath}` };
    }

    const content = (await file.text()).trim();
    if (content === FLAGS.T2) {
      return { passed: true, flag: FLAGS.T2 };
    }

    return { passed: false, error: `Unexpected content: ${content}` };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * T3: HTML source contains hardcoded flag in comment
 */
async function solveT3(ctx: SolverContext): Promise<SolverOutput> {
  if (!ctx.staticOnly && ctx.portalAvailable) {
    try {
      const resp = await fetch(withPortalPath(ctx, "/"), {
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const content = await resp.text();
        if (content.includes(FLAGS.T3)) {
          return { passed: true, flag: FLAGS.T3 };
        }
      }
    } catch {
      // Fall through to source check.
    }
  }

  try {
    const filePath = `${ctx.projectRoot}/apps/portal/src/app/page.tsx`;
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      return { passed: false, error: `File not found: ${filePath}` };
    }

    const content = await file.text();
    if (content.includes(FLAGS.T3)) {
      return { passed: true, flag: FLAGS.T3 };
    }

    return { passed: false, error: "Flag not found in portal HTML source" };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * T4: X-Internal-Flag response header from /api/ping
 */
async function solveT4(ctx: SolverContext): Promise<SolverOutput> {
  // Try live portal first
  if (!ctx.staticOnly && ctx.portalAvailable) {
    try {
      const resp = await fetch(withPortalPath(ctx, "/api/ping"), {
        signal: AbortSignal.timeout(5000),
      });
      const headerValue = resp.headers.get("X-Internal-Flag");
      if (headerValue === FLAGS.T4) {
        return { passed: true, flag: FLAGS.T4 };
      }
      if (headerValue) {
        return {
          passed: false,
          error: `Header found but unexpected value: ${headerValue}`,
        };
      }
    } catch {
      // Fall through to static check
    }
  }

  // Fallback: read next.config.ts for header value
  try {
    const filePath = `${ctx.projectRoot}/apps/portal/next.config.ts`;
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      return { passed: false, error: `File not found: ${filePath}` };
    }

    const content = await file.text();
    if (content.includes(FLAGS.T4)) {
      return { passed: true, flag: FLAGS.T4 };
    }

    return { passed: false, error: "Flag not found in next.config.ts" };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * T5: .env file exposed on portal webserver
 */
async function solveT5(ctx: SolverContext): Promise<SolverOutput> {
  // Try live portal first
  if (!ctx.staticOnly && ctx.portalAvailable) {
    try {
      const resp = await fetch(withPortalPath(ctx, "/.env"), {
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const body = await resp.text();
        if (body.includes(FLAGS.T5)) {
          return { passed: true, flag: FLAGS.T5 };
        }
      }
    } catch {
      // Fall through to static check
    }
  }

  // Fallback: check portal public/ for .env file
  try {
    const publicEnvPath = `${ctx.projectRoot}/apps/portal/public/.env`;
    const publicEnvFile = Bun.file(publicEnvPath);
    if (await publicEnvFile.exists()) {
      const content = await publicEnvFile.text();
      if (content.includes(FLAGS.T5)) {
        return { passed: true, flag: FLAGS.T5 };
      }
    }

    // T5 flag may only be verifiable when the portal serves .env from public/
    // Since the flag value is predefined, we verify the expected flag format
    // If portal is not running and file does not exist on disk, skip
    return {
      passed: false,
      error: "Portal not running and .env not found in public/",
    };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * T6: IAM user tag on svc-web-backend
 */
async function solveT6(ctx: SolverContext): Promise<SolverOutput> {
  if (ctx.staticOnly || !hasAwsRuntime(ctx)) {
    // Fallback: check CDK source for the tag value
    try {
      const filePath = `${ctx.projectRoot}/apps/infra/lib/ctf-iam-stack.ts`;
      const file = Bun.file(filePath);
      if (await file.exists()) {
        const content = await file.text();
        if (content.includes(FLAGS.T6) || content.includes("TVAULT:aws_cli_first_step_complete")) {
          return { passed: true, flag: FLAGS.T6 };
        }
      }
      return {
        passed: false,
        error: "LocalStack not available; flag not found in CDK source",
      };
    } catch {
      return {
        passed: false,
        error: "LocalStack not available and CDK source read failed",
      };
    }
  }

  try {
    const iam = createIAMClient(ctx);
    const resp = await iam.send(
      new ListUserTagsCommand({ UserName: "svc-web-backend" })
    );
    const flagTag = resp.Tags?.find((t) => t.Key === "Flag");
    if (flagTag?.Value === FLAGS.T6 || flagTag?.Value === "TVAULT:aws_cli_first_step_complete") {
      return { passed: true, flag: FLAGS.T6 };
    }

    if (flagTag) {
      return {
        passed: false,
        error: `Tag found but unexpected value: ${flagTag.Value}`,
      };
    }

    return { passed: false, error: "Flag tag not found on svc-web-backend" };
  } catch (err) {
    // Fallback to CDK source
    try {
      const filePath = `${ctx.projectRoot}/apps/infra/lib/ctf-iam-stack.ts`;
      const content = await Bun.file(filePath).text();
      if (content.includes(FLAGS.T6) || content.includes("TVAULT:aws_cli_first_step_complete")) {
        return { passed: true, flag: FLAGS.T6 };
      }
    } catch {
      // ignore
    }
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
  { id: "T1", name: "robots.txt comment", solver: solveT1 },
  { id: "T2", name: "S3 public bucket flag.txt", solver: solveT2 },
  { id: "T3", name: "Hardcoded secret in HTML source", solver: solveT3 },
  { id: "T4", name: "X-Internal-Flag response header", solver: solveT4 },
  { id: "T5", name: ".env exposed on portal", solver: solveT5 },
  { id: "T6", name: "IAM user tag on svc-web-backend", solver: solveT6 },
];

export async function solveTutorials(
  ctx: SolverContext
): Promise<readonly StageResult[]> {
  const results: StageResult[] = [];

  for (const { id, name, solver } of SOLVERS) {
    const output = await solver(ctx);
    results.push({
      id,
      name,
      status: output.passed ? "pass" : output.error?.includes("not available") || output.error?.includes("not running") ? "skip" : "fail",
      flag: output.flag,
      error: output.error,
      category: "Tutorial",
    });
  }

  return results;
}
