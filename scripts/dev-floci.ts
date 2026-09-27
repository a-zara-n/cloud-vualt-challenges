import { captureCommand, commandSucceeds, localAwsEnv, runCommand } from "./_helpers";

const endpoint = process.env.AWS_ENDPOINT_URL ?? "http://127.0.0.1:4566";
const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const defaultChatProxyUrl = "http://host.docker.internal:8787/chat";
const flociAwsEnv = localAwsEnv({
  AWS_DEFAULT_REGION: region,
  AWS_ENDPOINT_URL: endpoint,
  AWS_REGION: region,
});

async function getStackOutput(stackName: string, outputKey: string): Promise<string> {
  return captureCommand(`stack ${stackName} output ${outputKey}`, [
    "aws",
    "--endpoint-url",
    endpoint,
    "--region",
    region,
    "cloudformation",
    "describe-stacks",
    "--stack-name",
    stackName,
    "--query",
    `Stacks[0].Outputs[?OutputKey=='${outputKey}'].OutputValue | [0]`,
    "--output",
    "text",
  ], { env: flociAwsEnv });
}

async function ensureBucket(aws: string[], bucket: string): Promise<void> {
  const exists = await commandSucceeds([
    ...aws,
    "s3api",
    "head-bucket",
    "--bucket",
    bucket,
  ], { env: flociAwsEnv });

  if (!exists) {
    await runCommand(`S3 bucket ${bucket}`, [
      ...aws,
      "s3api",
      "create-bucket",
      "--bucket",
      bucket,
    ], { env: flociAwsEnv });
  }
}

async function seedStandaloneAssets(): Promise<void> {
  const aws = ["aws", "--endpoint-url", endpoint, "--region", region];
  const publicBucket = "techvault-public-assets-local";
  const internalBucket = "techvault-internal-2026-local";
  await ensureBucket(aws, publicBucket);
  await ensureBucket(aws, internalBucket);

  await runCommand("public S3 assets", [
    ...aws,
    "s3",
    "sync",
    "apps/infra/assets/s3/techvault-public-assets",
    `s3://${publicBucket}/`,
    "--acl",
    "public-read",
  ], { env: flociAwsEnv });

  await runCommand("generate scenario assets", [
    "bun",
    "run",
    "apps/infra/scripts/generate-s3-assets.ts",
    "local",
  ]);
  await runCommand("internal S3 assets", [
    ...aws,
    "s3",
    "sync",
    "apps/infra/.generated/s3/local/techvault-internal-2026",
    `s3://${internalBucket}/`,
  ], { env: flociAwsEnv });
  await runCommand("final evidence", [
    ...aws,
    "s3",
    "cp",
    "apps/infra/assets/evidence/evidence/final_flag.txt",
    `s3://${internalBucket}/evidence/final_flag.txt`,
  ], { env: flociAwsEnv });
}

async function ensureBedrockProxy(proxyUrl: string): Promise<void> {
  const healthUrl = new URL(proxyUrl);
  if (healthUrl.hostname === "host.docker.internal") {
    healthUrl.hostname = "127.0.0.1";
  }
  healthUrl.pathname = "/health";
  healthUrl.search = "";

  try {
    const response = await fetch(healthUrl);
    if (response.ok) return;
  } catch {
    // Report a concrete startup command below.
  }

  throw new Error(
    "Bedrock proxy is not running. Start it in another terminal: AWS_REGION=ap-northeast-1 bun run chat:bedrock-proxy"
  );
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const fullEnvironment = args.has("--full") || args.has("--with-aws-bedrock");
  const withAwsBedrock =
    args.has("--with-aws-bedrock") || process.env.CTF_USE_AWS_BEDROCK === "true";

  console.log(
    fullEnvironment
      ? "[dev:floci] Floci 上に Cloud Vault 問題環境を構築します"
      : "[dev:floci] Floci 上にCTFダッシュボードと問題環境を構築します",
  );

  if (withAwsBedrock) {
    await ensureBedrockProxy(process.env.PORTAL_CHAT_PROXY_URL ?? defaultChatProxyUrl);
  }

  if (!fullEnvironment) {
    await runCommand("floci", ["./scripts/floci.sh", "up"]);
    await runCommand("challenge catalog", [
      "bun",
      "run",
      "scripts/sync-challenge-catalog.ts",
    ]);
    await runCommand("infra bootstrap", [
      "zsh",
      "-lc",
      "bun run --cwd apps/infra scripts/cdkfloci.ts bootstrap --context stage=local --context challengeOnly=true",
    ]);
    await runCommand("challenge server", [
      "bun", "run", "scripts/deploy-floci.ts", "--challenge-only",
    ]);
    await seedStandaloneAssets();

    const [dashboardUrl, problemUrl] = await Promise.all([
      getStackOutput("ctf-challenge-server-local", "ChallengeServerUrl"),
      getStackOutput("ctf-challenge-server-local", "ProblemServerUrl"),
    ]);
    console.log("\n[dev:floci] 起動完了");
    console.log(`CTF dashboard: ${dashboardUrl}`);
    console.log(`Problem server: ${problemUrl}`);
    console.log(`EC2 endpoint: ${new URL("aws/ec2", problemUrl)}`);
    return;
  }

  const setupEnv = withAwsBedrock
    ? {
        PORTAL_CHAT_PROVIDER: process.env.PORTAL_CHAT_PROVIDER ?? "proxy",
        PORTAL_CHAT_PROXY_URL:
          process.env.PORTAL_CHAT_PROXY_URL ?? defaultChatProxyUrl,
        PORTAL_CHAT_STRICT_BEDROCK:
          process.env.PORTAL_CHAT_STRICT_BEDROCK ?? "true",
        BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID ?? "jp.amazon.nova-2-lite-v1:0",
      }
    : undefined;

  await runCommand(
    "setup",
    ["bun", "run", "setup"],
    setupEnv ? { env: setupEnv } : {},
  );

  const [challengeUrl, portalUrl, ec2EmulatorUrl] = await Promise.all([
    getStackOutput("ctf-challenge-server-local", "ChallengeServerUrl"),
    getStackOutput("ctf-portal-frontend-local", "PortalUrl"),
    getStackOutput("ctf-ec2-local", "EmulatedDescribeInstancesEndpoint"),
  ]);

  console.log("\n[dev:floci] 起動完了");
  console.log(`CTF dashboard: ${challengeUrl}`);
  console.log(`TechVault portal: ${portalUrl}`);
  console.log(`EC2 emulator: ${ec2EmulatorUrl}`);
  if (withAwsBedrock) {
    console.log("AWS Bedrock Runtime: chat proxy 経由で利用");
  }
  console.log("\n問題ページの Target ボタンから TechVault Portal を開けます。");
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error
      ? `[dev:floci] ${error.message}`
      : "[dev:floci] failed"
  );
  process.exit(1);
}
