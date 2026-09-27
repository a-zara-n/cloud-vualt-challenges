import { resolve } from "node:path";

const args = process.argv.slice(2);
const infraRoot = resolve(import.meta.dir, "..");
const nodePath = resolve(infraRoot, "node_modules");
const bin = resolve(nodePath, "aws-cdk", "bin", "cdk");
const hasOutputArg = args.some((arg) => arg === "--output" || arg.startsWith("--output="));
const outputArgs = hasOutputArg
  ? []
  : ["--output", resolve(infraRoot, "cdk.out.localstack")];
const env: Record<string, string | undefined> = {
  ...process.env,
  AWS_ACCESS_KEY_ID: "test",
  AWS_SECRET_ACCESS_KEY: "test",
  AWS_SESSION_TOKEN: "",
  AWS_EC2_METADATA_DISABLED: "true",
  AWS_REGION: "us-east-1",
  AWS_DEFAULT_REGION: "us-east-1",
  AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL ?? "http://localhost.localstack.cloud:4566",
  AWS_ENDPOINT_URL_S3:
    process.env.AWS_ENDPOINT_URL_S3 ?? "http://s3.localhost.localstack.cloud:4566",
  AWS_S3_FORCE_PATH_STYLE: "true",
  PWD: infraRoot,
  NODE_PATH: nodePath,
};

delete env.AWS_PROFILE;
delete env.AWS_DEFAULT_PROFILE;

const proc = Bun.spawn({
  // Newer CDK CLIs support AWS_ENDPOINT_URL directly. Invoking the CLI with
  // Node avoids aws-cdk-local's runtime patching, which lags CDK packaging changes.
  cmd: ["node", bin, ...args, ...outputArgs],
  cwd: infraRoot,
  env,
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

const exitCode = await proc.exited;
process.exit(exitCode ?? 1);
