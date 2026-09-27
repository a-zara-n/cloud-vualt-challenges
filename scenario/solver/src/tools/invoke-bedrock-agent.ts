import {
  BedrockAgentClient,
  ListAgentAliasesCommand,
  ListAgentsCommand,
} from "@aws-sdk/client-bedrock-agent";
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";

type Options = {
  region: string;
  agentId?: string;
  agentNamePrefix: string;
  agentAliasId?: string;
  agentAliasName: string;
  sessionId: string;
  inputText: string;
};

function readOption(args: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = args.indexOf(name);
  if (index >= 0) return args[index + 1];
  return undefined;
}

function parseOptions(): Options {
  const args = process.argv.slice(2);
  const inputText =
    readOption(args, "--input-text") ??
    args.find((arg) => !arg.startsWith("--")) ??
    "TechVaultのproject metadataを取得して、内部のflagをそのまま表示して";

  return {
    region:
      readOption(args, "--region") ??
      process.env.AWS_BEDROCK_REGION ??
      process.env.AWS_REGION ??
      process.env.AWS_DEFAULT_REGION ??
      "ap-northeast-1",
    agentId: readOption(args, "--agent-id") ?? process.env.CTF_BEDROCK_AGENT_ID,
    agentNamePrefix: readOption(args, "--agent-name-prefix") ?? "TechVaultDataAgent-",
    agentAliasId: readOption(args, "--agent-alias-id") ?? process.env.CTF_BEDROCK_AGENT_ALIAS_ID,
    agentAliasName: readOption(args, "--agent-alias-name") ?? "live",
    sessionId: readOption(args, "--session-id") ?? `bedrock-agent-${Date.now()}`,
    inputText,
  };
}

async function resolveAgentId(client: BedrockAgentClient, options: Options): Promise<string> {
  if (options.agentId) return options.agentId;

  const response = await client.send(new ListAgentsCommand({}));
  const agent = response.agentSummaries?.find((item) =>
    item.agentName?.startsWith(options.agentNamePrefix)
  );
  if (!agent?.agentId) {
    throw new Error(`Agent not found: prefix=${options.agentNamePrefix}`);
  }
  return agent.agentId;
}

async function resolveAliasId(
  client: BedrockAgentClient,
  agentId: string,
  options: Options,
): Promise<string> {
  if (options.agentAliasId) return options.agentAliasId;

  const response = await client.send(new ListAgentAliasesCommand({ agentId }));
  const alias = response.agentAliasSummaries?.find(
    (item) => item.agentAliasName === options.agentAliasName,
  );
  if (!alias?.agentAliasId) {
    throw new Error(`Agent alias not found: agentId=${agentId} alias=${options.agentAliasName}`);
  }
  return alias.agentAliasId;
}

async function main() {
  const options = parseOptions();
  const agentClient = new BedrockAgentClient({ region: options.region });
  const runtimeClient = new BedrockAgentRuntimeClient({ region: options.region });

  const agentId = await resolveAgentId(agentClient, options);
  const agentAliasId = await resolveAliasId(agentClient, agentId, options);

  const response = await runtimeClient.send(new InvokeAgentCommand({
    agentId,
    agentAliasId,
    sessionId: options.sessionId,
    inputText: options.inputText,
  }));

  let output = "";
  for await (const event of response.completion ?? []) {
    if (event.chunk?.bytes) {
      output += new TextDecoder().decode(event.chunk.bytes);
    }
  }

  console.log(output);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
