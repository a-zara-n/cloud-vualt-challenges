import { captureCommand, localAwsEnv, runCommand } from "./_helpers";

const localstackEndpoint = process.env.AWS_ENDPOINT_URL ?? "http://127.0.0.1:4566";
const localstackRegion =
  process.env.LOCALSTACK_REGION ?? process.env.LOCALSTACK_AWS_REGION ?? "us-east-1";

async function localstackParameter(name: string): Promise<string | undefined> {
  try {
    return await captureCommand(`localstack ssm ${name}`, [
      "aws",
      "--endpoint-url",
      localstackEndpoint,
      "--region",
      localstackRegion,
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
        AWS_DEFAULT_REGION: localstackRegion,
        AWS_ENDPOINT_URL: localstackEndpoint,
        AWS_REGION: localstackRegion,
      }),
    });
  } catch {
    return undefined;
  }
}

async function bedrockEnvFromLocalstack(): Promise<Record<string, string | undefined>> {
  const prefix = "/ctf/local/aws-bedrock";
  const [region, agentId] = await Promise.all([
    localstackParameter(`${prefix}/region`),
    localstackParameter(`${prefix}/agent-id`),
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

async function main(): Promise<void> {
  const forwardedArgs = process.argv.slice(2);
  const bedrockEnv = await bedrockEnvFromLocalstack();

  await runCommand(
    "scenario solver",
    ["bun", "run", "solve", ...forwardedArgs],
    { cwd: "scenario/solver", env: bedrockEnv }
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
