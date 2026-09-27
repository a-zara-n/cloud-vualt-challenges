import { captureCommand, localAwsEnv, runCommand } from "./_helpers";

const flociEndpoint = process.env.AWS_ENDPOINT_URL ?? "http://127.0.0.1:4566";
const flociRegion =
  process.env.FLOCI_REGION ?? process.env.FLOCI_AWS_REGION ?? "us-east-1";

async function flociParameter(name: string): Promise<string | undefined> {
  try {
    return await captureCommand(`floci ssm ${name}`, [
      "aws",
      "--endpoint-url",
      flociEndpoint,
      "--region",
      flociRegion,
      "ssm",
      "get-parameter",
      "--name",
      name,
      "--query",
      "Parameter.Value",
      "--output",
      "text",
    ], {
      env: localAwsEnv({
        AWS_DEFAULT_REGION: flociRegion,
        AWS_ENDPOINT_URL: flociEndpoint,
        AWS_REGION: flociRegion,
      }),
    });
  } catch {
    return undefined;
  }
}

async function bedrockEnvFromFloci(): Promise<Record<string, string | undefined>> {
  const prefix = "/ctf/local/aws-bedrock";
  const [region, agentId] = await Promise.all([
    flociParameter(`${prefix}/region`),
    flociParameter(`${prefix}/agent-id`),
  ]);

  if (!agentId) {
    return {};
  }

  return {
    AWS_BEDROCK_REGION: region,
    CTF_BEDROCK_AGENT_ID: agentId,
    CTF_USE_AWS_BEDROCK: "true",
  };
}

async function portalUrlFromFloci(): Promise<string | undefined> {
  try {
    const url = await captureCommand("floci portal output", [
      "aws", "--endpoint-url", flociEndpoint, "--region", flociRegion,
      "cloudformation", "describe-stacks", "--stack-name", "ctf-portal-frontend-local",
      "--query", "Stacks[0].Outputs[?OutputKey=='PortalUrl'].OutputValue | [0]",
      "--output", "text",
    ], { env: localAwsEnv() });
    return /^https?:\/\//.test(url) ? url : undefined;
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const forwardedArgs = process.argv.slice(2);
  const targetIndex = forwardedArgs.indexOf("--target");
  const target = targetIndex >= 0
    ? forwardedArgs[targetIndex + 1]
    : process.env.CTF_SOLVER_TARGET ?? "local";
  const portalUrl = target === "local" && !forwardedArgs.includes("--static") &&
    !process.env.CTF_PORTAL_URL && !process.env.TVAULT_PORTAL_URL
    ? await portalUrlFromFloci()
    : undefined;
  const bedrockEnv = await bedrockEnvFromFloci();

  await runCommand(
    "scenario solver",
    ["bun", "run", "solve", ...forwardedArgs],
    { cwd: "scenario/solver", env: { ...bedrockEnv, CTF_PORTAL_URL: portalUrl } }
  );
}

try {
  await main();
} catch (error) {
  console.error(
    error instanceof Error ? `[scenario] ${error.message}` : "[scenario] failed"
  );
  process.exit(1);
}
