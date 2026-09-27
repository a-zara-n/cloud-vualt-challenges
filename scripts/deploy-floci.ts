import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { captureCommand, localAwsEnv, runCommand } from "./_helpers";

const challengeOnly = process.argv.includes("--challenge-only");
const endpoint = process.env.AWS_ENDPOINT_URL ?? "http://127.0.0.1:4566";
const region = "us-east-1";
const projectRoot = resolve(import.meta.dir, "..");
const infraRoot = resolve(import.meta.dir, "../apps/infra");
const outputDir = resolve(infraRoot, "cdk.out.floci");
const context = challengeOnly
  ? ["--context", "stage=local", "--context", "challengeOnly=true"]
  : [];
const selection = challengeOnly ? "ctf-challenge-server-local" : "ctf-*-local";
const cdk = ["bun", "run", "--cwd", "apps/infra", "scripts/cdkfloci.ts"];
const aws = ["aws", "--endpoint-url", endpoint, "--region", region];
const awsOptions = { env: localAwsEnv({ AWS_DEFAULT_REGION: region }) };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function deployedTemplate(stackName: string): Promise<unknown | undefined> {
  let output: string;
  try {
    output = await captureCommand(`template ${stackName}`, [
      ...aws, "cloudformation", "get-template", "--stack-name", stackName,
      "--output", "json",
    ], awsOptions);
  } catch {
    return undefined;
  }
  const status = await captureCommand(`status ${stackName}`, [
    ...aws, "cloudformation", "describe-stacks", "--stack-name", stackName,
    "--query", "Stacks[0].StackStatus", "--output", "text",
  ], awsOptions);
  if (!/^(CREATE|UPDATE)_COMPLETE$/.test(status)) {
    throw new Error(`${stackName} is ${status}; resolve the Floci stack before redeploying`);
  }
  const body = JSON.parse(output).TemplateBody;
  return typeof body === "string" ? JSON.parse(body) : body;
}

async function main(): Promise<void> {
  await runCommand("floci synth", [...cdk, "synth", selection, ...context], { cwd: projectRoot });

  const manifest = JSON.parse(readFileSync(resolve(outputDir, "manifest.json"), "utf8"));
  const stacks = Object.entries(manifest.artifacts as Record<string, {
    type: string;
    properties?: { templateFile?: string };
  }>).filter(([name, artifact]) =>
    artifact.type === "aws:cloudformation:stack" &&
    (challengeOnly ? name === "ctf-challenge-server-local" : /^ctf-.*-local$/.test(name))
  );
  if (stacks.length === 0) throw new Error("No Floci stacks found in CDK output");

  const changed: string[] = [];
  for (const [name, artifact] of stacks) {
    const templateFile = artifact.properties?.templateFile;
    if (!templateFile) throw new Error(`Missing template for ${name}`);
    const local = JSON.parse(readFileSync(resolve(outputDir, templateFile), "utf8"));
    const deployed = await deployedTemplate(name);
    if (deployed === undefined || canonical(local) !== canonical(deployed)) {
      changed.push(name);
    }
  }

  if (changed.length === 0) {
    console.log("[floci deploy] CDK templates are unchanged; deployment skipped");
    return;
  }

  console.log(`[floci deploy] deploying ${changed.join(", ")}`);
  await runCommand("floci deploy", [
    ...cdk, "deploy", ...changed, ...context,
    "--exclusively", "--require-approval", "never",
  ], { cwd: projectRoot });
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? `[floci deploy] ${error.message}` : "[floci deploy] failed");
  process.exit(1);
}
