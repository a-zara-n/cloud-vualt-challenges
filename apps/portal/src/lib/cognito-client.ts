import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

interface CognitoClientOptions {
  region?: string;
  endpoint?: string;
}

export function createCognitoClient(
  options: CognitoClientOptions = {},
): CognitoIdentityProviderClient {
  const endpoint = options.endpoint !== undefined
    ? options.endpoint
    : process.env.AWS_ENDPOINT_URL || process.env.LOCALSTACK_ENDPOINT || undefined;

  return new CognitoIdentityProviderClient({
    region: options.region ??
      process.env.AWS_REGION ??
      process.env.AWS_DEFAULT_REGION ??
      "ap-northeast-1",
    endpoint,
    credentials: endpoint !== undefined
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
        }
      : undefined,
  });
}
