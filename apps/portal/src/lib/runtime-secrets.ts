import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const WEAK_VALUES = new Set([
  "SuperSecretPass2026!",
  "password",
  "change-me",
  "replace-with-strong-portal-password",
]);

const cache = new Map<string, string>();

function isProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.CTF_STAGE !== "local";
}

function ssmClient(): SSMClient {
  return new SSMClient({
    region: process.env.AWS_REGION ?? process.env.BEDROCK_RUNTIME_REGION ?? "ap-northeast-1",
    endpoint: process.env.AWS_ENDPOINT_URL || undefined,
  });
}

async function readSsmParameter(parameterName: string): Promise<string> {
  const cached = cache.get(parameterName);
  if (cached) return cached;

  const result = await ssmClient().send(
    new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    })
  );

  const value = result.Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter ${parameterName} has no value`);
  }

  cache.set(parameterName, value);
  return value;
}

async function secretValue(
  envName: string,
  parameterEnvName: string,
  devDefault: string | undefined
): Promise<string | undefined> {
  const parameterName = process.env[parameterEnvName];
  if (parameterName) return readSsmParameter(parameterName);

  return process.env[envName] ?? (isProduction() ? undefined : devDefault);
}

function validatePortalCredentials(email: string | undefined, password: string | undefined): {
  email: string;
  password: string;
} {
  if (!email || !password) {
    throw new Error(
      "PORTAL_ADMIN_EMAIL_PARAM and PORTAL_ADMIN_PASSWORD_PARAM are required in production"
    );
  }

  if (isProduction() && (password.length < 12 || WEAK_VALUES.has(password))) {
    throw new Error("PORTAL_ADMIN_PASSWORD is using an unsafe value");
  }

  return { email, password };
}

export function clearPortalSecretCacheForTests(): void {
  cache.clear();
}

export async function getPortalCredentials(devDefaults: {
  email: string;
  password: string;
}): Promise<{ email: string; password: string }> {
  const [email, password] = await Promise.all([
    secretValue("PORTAL_ADMIN_EMAIL", "PORTAL_ADMIN_EMAIL_PARAM", devDefaults.email),
    secretValue("PORTAL_ADMIN_PASSWORD", "PORTAL_ADMIN_PASSWORD_PARAM", devDefaults.password),
  ]);

  return validatePortalCredentials(email, password);
}
