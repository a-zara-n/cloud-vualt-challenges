import { captureCommand } from "./_helpers";

export const DEV_STAGE = process.env.CTF_STAGE ?? "dev";
export const AWS_REGION =
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";

interface StackOutput {
  readonly OutputKey?: string;
  readonly OutputValue?: string;
}

export async function describeStackOutputs(stackName: string): Promise<readonly StackOutput[]> {
  const raw = await captureCommand(`describe ${stackName}`, [
    "aws",
    "cloudformation",
    "describe-stacks",
    "--region",
    AWS_REGION,
    "--stack-name",
    stackName,
    "--query",
    "Stacks[0].Outputs",
    "--output",
    "json",
  ]);

  return JSON.parse(raw || "[]") as StackOutput[];
}

export async function stackOutput(
  stackName: string,
  outputKey: string,
  alternatives: readonly string[] = []
): Promise<string> {
  const outputs = await describeStackOutputs(stackName);
  const keys = [outputKey, ...alternatives];
  const match = outputs.find((output) => keys.includes(output.OutputKey ?? ""));

  if (!match?.OutputValue) {
    throw new Error(
      `${stackName} の Output ${keys.join(" / ")} が見つかりません。先に CDK deploy を実行してください。`
    );
  }

  return match.OutputValue;
}

export async function ssmSecureString(name: string): Promise<string> {
  return captureCommand(`ssm ${name}`, [
    "aws",
    "ssm",
    "get-parameter",
    "--region",
    AWS_REGION,
    "--name",
    name,
    "--with-decryption",
    "--query",
    "Parameter.Value",
    "--output",
    "text",
  ]);
}
