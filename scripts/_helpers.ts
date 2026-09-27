import { resolve } from "node:path";

interface RunOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  replaceEnv?: boolean;
}

function commandContext(options: RunOptions): {
  cwd: string;
  env: Record<string, string>;
} {
  const cwd = options.cwd ? resolve(process.cwd(), options.cwd) : process.cwd();
  const values = options.replaceEnv
    ? { PWD: cwd, ...options.env }
    : { ...process.env, PWD: cwd, ...options.env };
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) env[key] = value;
  }

  return { cwd, env };
}

export function localAwsEnv(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    ...process.env,
    AWS_ACCESS_KEY_ID: "test",
    AWS_SECRET_ACCESS_KEY: "test",
    AWS_SESSION_TOKEN: "",
    AWS_EC2_METADATA_DISABLED: "true",
    ...overrides,
  };

  delete env.AWS_PROFILE;
  delete env.AWS_DEFAULT_PROFILE;

  return env;
}

export async function runCommand(
  label: string,
  cmd: string[],
  options: RunOptions = {}
): Promise<void> {
  const { cwd, env } = commandContext(options);

  console.log(`\n[${label}] ${cmd.join(" ")}`);
  if (cwd !== process.cwd()) {
    console.log(`[${label}] cwd: ${cwd}`);
  }

  const proc = Bun.spawn({
    cmd,
    cwd,
    env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`[${label}] failed with exit code ${exitCode}`);
  }
}

export async function captureCommand(
  label: string,
  cmd: string[],
  options: RunOptions = {}
): Promise<string> {
  const { cwd, env } = commandContext(options);

  const proc = Bun.spawn({
    cmd,
    cwd,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`[${label}] ${stderr.trim() || cmd.join(" ")} failed`);
  }

  return stdout.trim();
}

export async function commandSucceeds(
  cmd: string[],
  options: RunOptions = {},
): Promise<boolean> {
  const { cwd, env } = commandContext(options);
  const proc = Bun.spawn({ cmd, cwd, env, stdout: "ignore", stderr: "ignore" });
  return (await proc.exited) === 0;
}

export function toAbsolutePath(path: string): string {
  return resolve(process.cwd(), path);
}
