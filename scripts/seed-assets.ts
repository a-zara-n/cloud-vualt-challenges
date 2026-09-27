import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { generateCloudTrailAssets } from "../apps/infra/lib/cloudtrail-assets";
import { generateS3Assets } from "../apps/infra/lib/s3-assets";

interface SeedAssetsResult {
  readonly s3RootDir: string;
  readonly internalBucketDir: string;
  readonly cloudTrailStage4Dir: string;
  readonly cloudTrailDir: string;
  readonly cloudTrailAccountId: string;
  readonly cloudTrailRegion: string;
  readonly s3VectorsBucketName?: string;
  readonly s3VectorsIndexName?: string;
}

const SOURCE_ACCOUNT_ID = "123456789012";
const LOCAL_EMULATOR_ACCOUNT_ID = "000000000000";
const DEFAULT_REGION = "ap-northeast-1";
const TITAN_EMBEDDING_MODEL_ID = "amazon.titan-embed-text-v2:0";
const TITAN_EMBEDDING_DIMENSIONS = 1024;

interface VectorSeedRecord {
  readonly key: string;
  readonly data?: {
    readonly float32?: readonly number[];
  };
  readonly metadata: Record<string, unknown>;
}

function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed || trimmed === "undefined" || trimmed === "null") continue;
    return trimmed;
  }
  return undefined;
}

function isLocalSeed(): boolean {
  const stage = firstEnv("CTF_STAGE", "STAGE");
  if (stage) return stage === "local";

  return (
    process.env.IS_LOCAL === "true"
  );
}

function resolveAccountId(): string {
  const explicit = firstEnv(
    "CTF_CLOUDTRAIL_ACCOUNT_ID",
    "CDK_DEFAULT_ACCOUNT",
    "AWS_ACCOUNT_ID",
  );
  if (explicit) return explicit;

  if (isLocalSeed()) return LOCAL_EMULATOR_ACCOUNT_ID;

  try {
    const accountId = execFileSync(
      "aws",
      ["sts", "get-caller-identity", "--query", "Account", "--output", "text"],
      {
        encoding: "utf8",
        env: process.env,
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();

    if (accountId) return accountId;
  } catch {
    console.warn(
      `  Warning: AWS account ID could not be resolved; using ${SOURCE_ACCOUNT_ID} for generated CloudTrail assets.`,
    );
  }

  return SOURCE_ACCOUNT_ID;
}

function resolveRegion(): string {
  return firstEnv("CTF_CLOUDTRAIL_REGION", "CDK_DEFAULT_REGION", "AWS_REGION", "AWS_DEFAULT_REGION") ?? DEFAULT_REGION;
}

function resolveBedrockRegion(): string {
  return firstEnv("AWS_BEDROCK_REGION", "BEDROCK_RUNTIME_REGION", "AWS_REGION", "AWS_DEFAULT_REGION") ?? DEFAULT_REGION;
}

function resolveStage(): string {
  return firstEnv("CTF_STAGE", "STAGE") ?? "dev";
}

function shouldPushEcrAssets(): boolean {
  if (isLocalSeed()) return false;
  if (process.env.CTF_SEED_PUSH_ECR === "false") return false;
  if (process.env.CTF_SKIP_ECR_PUSH === "true") return false;
  return true;
}

function shouldSeedS3Vectors(): boolean {
  if (isLocalSeed()) return false;
  if (process.env.CTF_SEED_S3_VECTORS === "false") return false;
  if (process.env.CTF_SKIP_S3_VECTORS === "true") return false;
  return true;
}

function pushEcrAssets(stage: string): void {
  const projectRoot = join(import.meta.dir, "..");
  execFileSync("bun", ["run", "scripts/push-ecr-assets.ts", "--stage", stage], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });
}

function embeddingInputText(record: VectorSeedRecord): string {
  const metadata = record.metadata;
  return [
    metadata.title,
    metadata.documentType,
    metadata.tenantName,
    metadata.classification,
    metadata.username,
    metadata.password,
    metadata.secretNote,
    metadata.documentBody,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n");
}

function titanEmbedding(text: string, region: string): number[] {
  const workDir = mkdtempSync(join(tmpdir(), "cloud-fortress-titan-"));
  const requestPath = join(workDir, "request.json");
  const responsePath = join(workDir, "response.json");

  try {
    writeFileSync(
      requestPath,
      JSON.stringify({
        inputText: text,
        dimensions: TITAN_EMBEDDING_DIMENSIONS,
        normalize: true,
      }),
    );

    execFileSync(
      "aws",
      [
        "bedrock-runtime",
        "invoke-model",
        "--region",
        region,
        "--model-id",
        firstEnv("CTF_S3_VECTORS_EMBEDDING_MODEL", "BEDROCK_EMBEDDING_MODEL_ID") ?? TITAN_EMBEDDING_MODEL_ID,
        "--content-type",
        "application/json",
        "--accept",
        "application/json",
        "--body",
        `fileb://${requestPath}`,
        responsePath,
      ],
      {
        env: process.env,
        stdio: ["ignore", "ignore", "inherit"],
      },
    );

    const response = JSON.parse(readFileSync(responsePath, "utf8")) as {
      readonly embedding?: unknown;
    };
    if (!Array.isArray(response.embedding)) {
      throw new Error("Titan embedding response did not include embedding");
    }

    return response.embedding.map((value) => Number(value));
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function buildTitanVectorPayload(vectorsPath: string, bedrockRegion: string): string {
  const records = JSON.parse(readFileSync(vectorsPath, "utf8")) as VectorSeedRecord[];
  const generated = records.map((record) => ({
    key: record.key,
    data: {
      float32: titanEmbedding(embeddingInputText(record), bedrockRegion),
    },
    metadata: record.metadata,
  }));

  const workDir = mkdtempSync(join(tmpdir(), "cloud-fortress-s3vectors-"));
  const generatedPath = join(workDir, "customer-vault-documents-titan-v2.json");
  writeFileSync(generatedPath, JSON.stringify(generated, null, 2));
  return generatedPath;
}

function seedS3Vectors(stage: string, region: string): {
  readonly bucketName: string;
  readonly indexName: string;
} {
  const projectRoot = join(import.meta.dir, "..");
  const vectorsPath = join(
    projectRoot,
    "apps/infra/assets/s3-vectors/customer-vault-documents.json",
  );
  const bucketName = firstEnv("CTF_S3_VECTORS_BUCKET") ?? `techvault-vault-vectors-${stage}`;
  const indexName = firstEnv("CTF_S3_VECTORS_INDEX") ?? "customer-vault-documents-titan-v2";
  const generatedVectorsPath = buildTitanVectorPayload(vectorsPath, resolveBedrockRegion());

  try {
    execFileSync(
      "aws",
      [
        "s3vectors",
        "put-vectors",
        "--region",
        region,
        "--vector-bucket-name",
        bucketName,
        "--index-name",
        indexName,
        "--vectors",
        `file://${generatedVectorsPath}`,
      ],
      {
        cwd: projectRoot,
        env: process.env,
        stdio: "inherit",
      },
    );
  } finally {
    rmSync(dirname(generatedVectorsPath), { recursive: true, force: true });
  }

  return { bucketName, indexName };
}

export async function seedAssets(): Promise<SeedAssetsResult> {
  console.log("=== Build Seed Assets ===");

  const stage = resolveStage();
  const cloudTrailAccountId = resolveAccountId();
  const cloudTrailRegion = resolveRegion();
  const generatedS3Assets = generateS3Assets(stage);
  const generatedCloudTrailAssets = generateCloudTrailAssets(
    undefined,
    cloudTrailAccountId,
    cloudTrailRegion,
  );

  const result: SeedAssetsResult = {
    s3RootDir: generatedS3Assets.rootDir,
    internalBucketDir: generatedS3Assets.internalBucketDir,
    cloudTrailStage4Dir: generatedCloudTrailAssets.stage4Dir,
    cloudTrailDir: generatedCloudTrailAssets.cloudTrailDir,
    cloudTrailAccountId,
    cloudTrailRegion,
  };

  console.log(`  - S3 assets: ${result.s3RootDir}`);
  console.log(`  - Internal bucket assets: ${result.internalBucketDir}`);
  console.log(`  - Stage 4 CloudTrail ZIP assets: ${result.cloudTrailStage4Dir}`);
  console.log(`  - CloudTrail reference assets: ${result.cloudTrailDir}`);
  console.log(
    `  - CloudTrail account/region: ${result.cloudTrailAccountId}/${result.cloudTrailRegion}`,
  );

  if (shouldPushEcrAssets()) {
    console.log(`  - ECR image push: techvault/data-processor-${stage}:latest`);
    pushEcrAssets(stage);
  } else {
    console.log("  - ECR image push: skipped");
  }

  let s3VectorsBucketName: string | undefined;
  let s3VectorsIndexName: string | undefined;
  if (shouldSeedS3Vectors()) {
    const vectorSeed = seedS3Vectors(stage, cloudTrailRegion);
    s3VectorsBucketName = vectorSeed.bucketName;
    s3VectorsIndexName = vectorSeed.indexName;
    console.log(
      `  - S3 Vectors seed: ${vectorSeed.bucketName}/${vectorSeed.indexName}`,
    );
  } else {
    console.log("  - S3 Vectors seed: skipped");
  }

  Object.assign(result, {
    s3VectorsBucketName,
    s3VectorsIndexName,
  });

  console.log("Seed asset build completed!");

  return result;
}

if (import.meta.main) {
  seedAssets().catch((err) => {
    console.error("Seed asset build failed:", err);
    process.exit(1);
  });
}
