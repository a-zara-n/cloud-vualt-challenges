import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { captureCommand, commandSucceeds, runCommand } from "./_helpers";

const awsEnv = {
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?? "test",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
  AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION ?? "us-east-1",
};
const endpoint = process.env.AWS_ENDPOINT_URL ?? "http://127.0.0.1:4566";
const registry = "000000000000.dkr.ecr.us-east-1.localhost.localstack.cloud:4566";
const cloudTrailObjectKey =
  "AWSLogs/123456789012/CloudTrail/ap-northeast-1/2026/02/01/" +
  "123456789012_CloudTrail_ap-northeast-1_20260201T0000Z_techvault.json.gz";
const cloudTrailStage4ZipKey = "stage4/cloudtrail-logs.zip";
const cloudTrailBundlePath = join(
  "season/Cloud-Vault/assets/cloudtrail",
  cloudTrailObjectKey,
);
const cloudTrailStage4ZipPath = join(
  "season/Cloud-Vault/assets",
  "cloudtrail-logs.zip",
);

async function ensureGitRepos(): Promise<void> {
  await runCommand("ctf git repos", [
    "bash",
    "season/Cloud-Vault/repos/setup-repos.sh",
  ]);
}

async function ensureCloudTrailBundle(): Promise<void> {
  await runCommand("cloudtrail bundle", [
    "zsh",
    "-lc",
    "ASDF_PYTHON_VERSION=${ASDF_PYTHON_VERSION:-3.14.4} python3 season/Cloud-Vault/assets/generate-cloudtrail.py",
  ]);

  await runCommand("cloudtrail upload", [
    "aws",
    "--endpoint-url",
    endpoint,
    "s3",
    "cp",
    cloudTrailBundlePath,
    `s3://techvault-cloudtrail-logs-local/${cloudTrailObjectKey}`,
  ], { env: awsEnv });

  await runCommand("cloudtrail stage4 zip upload", [
    "aws",
    "--endpoint-url",
    endpoint,
    "s3",
    "cp",
    cloudTrailStage4ZipPath,
    `s3://techvault-cloudtrail-logs-local/${cloudTrailStage4ZipKey}`,
  ], { env: awsEnv });
}

async function ensureEcrRepository(name: string): Promise<void> {
  const exists = await commandSucceeds(
    [
      "aws",
      "--endpoint-url",
      endpoint,
      "ecr",
      "describe-repositories",
      "--repository-names",
      name,
    ],
    { env: awsEnv },
  );

  if (exists) return;

  await runCommand("ecr create", [
    "aws",
    "--endpoint-url",
    endpoint,
    "ecr",
    "create-repository",
    "--repository-name",
    name,
  ], { env: awsEnv });
}

async function ensureDockerImage(): Promise<void> {
  await runCommand("docker login localstack ecr", [
    "zsh",
    "-lc",
    `aws --endpoint-url ${endpoint} ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${registry}`,
  ], { env: awsEnv });

  await ensureEcrRepository("techvault/data-processor-local");
  await ensureEcrRepository("techvault/data-processor");

  await runCommand("docker build data-processor", [
    "docker",
    "build",
    "-t",
    "cloud-vault/data-processor:latest",
    "apps/infra/docker/data-processor",
  ]);

  for (const repo of ["techvault/data-processor-local", "techvault/data-processor"]) {
    const image = `${registry}/${repo}:latest`;
    await runCommand("docker tag data-processor", [
      "docker",
      "tag",
      "cloud-vault/data-processor:latest",
      image,
    ]);
    await runCommand("docker push data-processor", ["docker", "push", image]);
  }
}

async function ensureLambdaCompatFunction(): Promise<void> {
  const workDir = "/tmp/cloud-vault-lambda";
  const zipPath = join(workDir, "techvault-data-processor.zip");
  mkdirSync(workDir, { recursive: true });

  await runCommand("lambda zip data-processor", [
    "zsh",
    "-lc",
    `cd apps/infra/lambda/data-processor && zip -qr ${zipPath} .`,
  ]);

  const envPath = join(workDir, "data-processor-env.json");
  writeFileSync(
    envPath,
    JSON.stringify({
      Variables: {
        DB_HOST: "internal-db.techvault.local",
        DB_PORT: "5432",
        DB_NAME: "techvault_analytics",
        DB_USER: "processor_user",
        LOG_LEVEL: "debug",
        SSM_SECRET_PATH: "/techvault/internal/api-key",
        FLAG: "TVAULT{lambda_env_is_not_a_vault}",
      },
    }),
  );

  const functionName = "techvault-data-processor";
  const exists = await commandSucceeds(
    [
      "aws",
      "--endpoint-url",
      endpoint,
      "lambda",
      "get-function-configuration",
      "--function-name",
      functionName,
    ],
    { env: awsEnv },
  );

  if (exists) {
    await runCommand("lambda update code", [
      "aws",
      "--endpoint-url",
      endpoint,
      "lambda",
      "update-function-code",
      "--function-name",
      functionName,
      "--zip-file",
      `fileb://${zipPath}`,
    ], { env: awsEnv });
    await runCommand("lambda update env", [
      "aws",
      "--endpoint-url",
      endpoint,
      "lambda",
      "update-function-configuration",
      "--function-name",
      functionName,
      "--environment",
      `file://${envPath}`,
    ], { env: awsEnv });
    return;
  }

  await runCommand("lambda create compat", [
    "aws",
    "--endpoint-url",
    endpoint,
    "lambda",
    "create-function",
    "--function-name",
    functionName,
    "--runtime",
    "python3.12",
    "--handler",
    "index.lambda_handler",
    "--role",
    "arn:aws:iam::000000000000:role/LambdaExecutionRole-processor-local",
    "--zip-file",
    `fileb://${zipPath}`,
    "--environment",
    `file://${envPath}`,
  ], { env: awsEnv });
}

async function ensureCognitoAutoConfirm(): Promise<void> {
  const userPoolId = await captureCommand("cognito user pool", [
    "aws",
    "--endpoint-url",
    endpoint,
    "cognito-idp",
    "list-user-pools",
    "--max-results",
    "10",
    "--query",
    "UserPools[?contains(Name, `TechVaultEmployeePool`)].Id | [0]",
    "--output",
    "text",
  ], { env: awsEnv });

  if (!userPoolId || userPoolId === "None") {
    throw new Error("TechVaultEmployeePool was not found");
  }

  const workDir = "/tmp/cloud-vault-lambda";
  const triggerDir = join(workDir, "cognito-auto-confirm");
  const zipPath = join(workDir, "cognito-auto-confirm.zip");
  mkdirSync(triggerDir, { recursive: true });
  writeFileSync(
    join(triggerDir, "index.mjs"),
    [
      "export async function handler(event) {",
      "  event.response.autoConfirmUser = true;",
      "  event.response.autoVerifyEmail = true;",
      "  return event;",
      "}",
      "",
    ].join("\n"),
  );

  await runCommand("cognito trigger zip", [
    "zsh",
    "-lc",
    `cd ${triggerDir} && zip -qr ${zipPath} .`,
  ]);

  const functionName = "techvault-cognito-auto-confirm";
  const functionArn = `arn:aws:lambda:us-east-1:000000000000:function:${functionName}`;
  const exists = await commandSucceeds(
    [
      "aws",
      "--endpoint-url",
      endpoint,
      "lambda",
      "get-function-configuration",
      "--function-name",
      functionName,
    ],
    { env: awsEnv },
  );

  if (exists) {
    await runCommand("cognito trigger update", [
      "aws",
      "--endpoint-url",
      endpoint,
      "lambda",
      "update-function-code",
      "--function-name",
      functionName,
      "--zip-file",
      `fileb://${zipPath}`,
    ], { env: awsEnv });
  } else {
    await runCommand("cognito trigger create", [
      "aws",
      "--endpoint-url",
      endpoint,
      "lambda",
      "create-function",
      "--function-name",
      functionName,
      "--runtime",
      "nodejs20.x",
      "--handler",
      "index.handler",
      "--role",
      "arn:aws:iam::000000000000:role/LambdaExecutionRole-portal-local",
      "--zip-file",
      `fileb://${zipPath}`,
    ], { env: awsEnv });
  }

  await runCommand("cognito trigger attach", [
    "aws",
    "--endpoint-url",
    endpoint,
    "cognito-idp",
    "update-user-pool",
    "--user-pool-id",
    userPoolId,
    "--lambda-config",
    `PreSignUp=${functionArn}`,
  ], { env: awsEnv });
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const localstackRequired = !args.has("--static-only");

  await ensureGitRepos();

  if (!localstackRequired) {
    console.log("[setup additional] static assets only");
    return;
  }

  await ensureCloudTrailBundle();
  await ensureDockerImage();
  await ensureLambdaCompatFunction();
  await ensureCognitoAutoConfirm();

  if (!existsSync(cloudTrailBundlePath)) {
    throw new Error("CloudTrail bundle was not created");
  }
  if (!existsSync(cloudTrailStage4ZipPath)) {
    throw new Error("Stage 4 CloudTrail zip was not created");
  }

  console.log("\n[setup additional] completed");
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error
      ? `[setup additional] ${error.message}`
      : "[setup additional] failed",
  );
  process.exit(1);
}
