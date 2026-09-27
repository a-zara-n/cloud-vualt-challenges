import { PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

interface SecretSpec {
  label: string;
  parameterName: string;
  opRef: string;
  minLength: number;
  kind: "email" | "password" | "secret";
}

const WEAK_VALUES = new Set([
  "admin",
  "password",
  "change-me",
  "SuperSecretPass2026!",
  "replace-with-strong-portal-password",
]);

function usage(): never {
  throw new Error(
    [
      "Usage: bun run scripts/seed-secrets.ts --stage <dev|prod> [--region ap-northeast-1]",
      "",
      "Default 1Password refs:",
      "  op://Cloud Fortress/<stage>/portal-admin-email/email",
      "  op://Cloud Fortress/<stage>/portal-admin-password/password",
      "",
      "Override refs with:",
      "  CTF_OP_ACCOUNT",
      "  CTF_PORTAL_ADMIN_EMAIL_OP_REF",
      "  CTF_PORTAL_ADMIN_PASSWORD_OP_REF",
    ].join("\n")
  );
}

function argValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) usage();
  return value;
}

function stage(): string {
  const value = argValue("--stage") ?? process.env.CTF_STAGE ?? "dev";
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    throw new Error(`Invalid stage: ${value}`);
  }
  if (value === "local") {
    throw new Error("local stage uses local development defaults and must not be seeded from 1Password");
  }
  if (value !== "dev" && value !== "prod") {
    throw new Error(`Unsupported stage: ${value}. Use dev or prod.`);
  }
  return value;
}

function region(): string {
  return (
    argValue("--region") ??
    process.env.AWS_REGION ??
    process.env.AWS_DEFAULT_REGION ??
    "ap-northeast-1"
  );
}

function opAccount(): string | undefined {
  return argValue("--op-account") ?? process.env.CTF_OP_ACCOUNT ?? process.env.OP_ACCOUNT;
}

function trimFinalNewline(value: string): string {
  return value.replace(/\r?\n$/, "");
}

function opCommand(args: string[], account: string | undefined): string[] {
  return account ? ["op", ...args, "--account", account] : ["op", ...args];
}

async function opRead(ref: string, account: string | undefined): Promise<string> {
  const proc = Bun.spawn({
    cmd: opCommand(["read", ref], account),
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`[op] failed to read ${ref}: ${stderr.trim() || `exit code ${exitCode}`}`);
  }

  return trimFinalNewline(stdout);
}

async function requireOpSession(account: string | undefined): Promise<void> {
  const proc = Bun.spawn({
    cmd: opCommand(["whoami"], account),
    stdout: "ignore",
    stderr: "pipe",
  });

  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`[op] sign in first: ${stderr.trim() || "op whoami failed"}`);
  }
}

function validateSecret(spec: SecretSpec, value: string): void {
  if (value.length < spec.minLength) {
    throw new Error(`${spec.label} from ${spec.opRef} must be at least ${spec.minLength} characters`);
  }

  if (spec.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`${spec.label} from ${spec.opRef} is not a valid email address`);
  }

  if (spec.kind !== "email" && WEAK_VALUES.has(value)) {
    throw new Error(`${spec.label} from ${spec.opRef} is using a known unsafe value`);
  }
}

async function main(): Promise<void> {
  const targetStage = stage();
  const targetRegion = region();
  const targetOpAccount = opAccount();
  const opPrefix = process.env.CTF_OP_PREFIX ?? `op://Cloud Fortress/${targetStage}`;
  const specs: SecretSpec[] = [
    {
      label: "TechVault admin email",
      parameterName: `/ctf/${targetStage}/portal-admin-email`,
      opRef: process.env.CTF_PORTAL_ADMIN_EMAIL_OP_REF ?? `${opPrefix}/portal-admin-email/email`,
      minLength: 3,
      kind: "email",
    },
    {
      label: "TechVault admin password",
      parameterName: `/ctf/${targetStage}/portal-admin-password`,
      opRef:
        process.env.CTF_PORTAL_ADMIN_PASSWORD_OP_REF ??
        `${opPrefix}/portal-admin-password/password`,
      minLength: 12,
      kind: "password",
    },
  ];

  await requireOpSession(targetOpAccount);

  const ssm = new SSMClient({ region: targetRegion });
  console.log(`[secrets] stage=${targetStage} region=${targetRegion}`);

  for (const spec of specs) {
    const value = await opRead(spec.opRef, targetOpAccount);
    validateSecret(spec, value);
    await ssm.send(
      new PutParameterCommand({
        Name: spec.parameterName,
        Type: "SecureString",
        Value: value,
        Overwrite: true,
      })
    );
    console.log(`[secrets] wrote ${spec.parameterName} from ${spec.opRef}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
