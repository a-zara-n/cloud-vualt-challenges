import { captureCommand, runCommand } from "./_helpers";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: bun run scripts/push-ecr-assets.ts --stage <dev|prod>");
  console.log("Env: AWS_REGION=ap-northeast-1 CTF_ECR_PLATFORMS=linux/amd64,linux/arm64");
  process.exit(0);
}

const stageArg = args.find((arg) => arg.startsWith("--stage="));
const stageIndex = args.indexOf("--stage");
const stage =
  stageArg?.split("=", 2)[1] ??
  (stageIndex >= 0 ? args[stageIndex + 1] : undefined) ??
  process.env.CTF_STAGE ??
  "dev";
const region =
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const repositoryName = `techvault/data-processor-${stage}`;
const platforms = process.env.CTF_ECR_PLATFORMS ?? "linux/amd64,linux/arm64";

async function ensureRepositoryExists(): Promise<void> {
  await captureCommand(`ecr describe ${repositoryName}`, [
    "aws",
    "ecr",
    "describe-repositories",
    "--region",
    region,
    "--repository-names",
    repositoryName,
  ]).catch((error) => {
    throw new Error(
      `${repositoryName} が見つかりません。先に CDK deploy で ctf-ecr-${stage} を作成してください。\n${error instanceof Error ? error.message : String(error)}`,
    );
  });
}

async function main(): Promise<void> {
  await ensureRepositoryExists();

  const accountId = await captureCommand("aws account id", [
    "aws",
    "sts",
    "get-caller-identity",
    "--query",
    "Account",
    "--output",
    "text",
  ]);
  const registry = `${accountId}.dkr.ecr.${region}.amazonaws.com`;
  const remoteImage = `${registry}/${repositoryName}:latest`;

  await runCommand("ecr login", [
    "zsh",
    "-lc",
    `aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${registry}`,
  ]);

  await runCommand("docker buildx push data-processor", [
    "docker",
    "buildx",
    "build",
    "--platform",
    platforms,
    "-t",
    remoteImage,
    "--provenance=false",
    "--push",
    "apps/infra/docker/data-processor",
  ]);

  console.log(`[ecr] pushed ${remoteImage}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
