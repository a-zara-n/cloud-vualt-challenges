import { S3Client } from "@aws-sdk/client-s3";
import { IAMClient } from "@aws-sdk/client-iam";
import { STSClient } from "@aws-sdk/client-sts";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { EC2Client } from "@aws-sdk/client-ec2";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SSMClient } from "@aws-sdk/client-ssm";
import { ECRClient } from "@aws-sdk/client-ecr";
import {
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { BedrockAgentClient } from "@aws-sdk/client-bedrock-agent";
import { BedrockAgentRuntimeClient } from "@aws-sdk/client-bedrock-agent-runtime";
import type { SolverTarget } from "./target.js";

const LOCALSTACK_ENDPOINT =
  process.env.LOCALSTACK_ENDPOINT ?? process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566";
const REGION = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
const CREDENTIALS = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
};

export interface AwsCredentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string;
}

interface RuntimeContext {
  readonly target?: SolverTarget;
  readonly credentials?: AwsCredentials;
}

interface ClientConfig {
  region: string;
  endpoint?: string;
  credentials?: AwsCredentials;
  forcePathStyle?: boolean;
}

function shouldUseLocalStack(ctx?: RuntimeContext): boolean {
  return (ctx?.target ?? process.env.CTF_SOLVER_TARGET ?? "local") === "local";
}

function baseConfig(ctx?: RuntimeContext): ClientConfig {
  if (!shouldUseLocalStack(ctx)) {
    return {
      region: REGION,
      credentials: ctx?.credentials,
    };
  }

  return {
    region: REGION,
    endpoint: LOCALSTACK_ENDPOINT,
    credentials: ctx?.credentials ?? CREDENTIALS,
  };
}

export function createS3Client(ctx?: RuntimeContext): S3Client {
  return new S3Client({
    ...baseConfig(ctx),
    forcePathStyle: shouldUseLocalStack(ctx),
  });
}

export function createIAMClient(ctx?: RuntimeContext): IAMClient {
  return new IAMClient(baseConfig(ctx));
}

export function createSTSClient(ctx?: RuntimeContext): STSClient {
  return new STSClient(baseConfig(ctx));
}

export function createLambdaClient(ctx?: RuntimeContext): LambdaClient {
  return new LambdaClient(baseConfig(ctx));
}

export function createEC2Client(ctx?: RuntimeContext): EC2Client {
  return new EC2Client(baseConfig(ctx));
}

export function createSecretsManagerClient(ctx?: RuntimeContext): SecretsManagerClient {
  return new SecretsManagerClient(baseConfig(ctx));
}

export function createSSMClient(ctx?: RuntimeContext): SSMClient {
  return new SSMClient(baseConfig(ctx));
}

export function createECRClient(ctx?: RuntimeContext): ECRClient {
  return new ECRClient(baseConfig(ctx));
}

export function createCognitoClient(ctx?: RuntimeContext): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient(baseConfig(ctx));
}

export function createBedrockAgentClient(ctx?: RuntimeContext): BedrockAgentClient {
  return new BedrockAgentClient(baseConfig(ctx));
}

export function createBedrockAgentRuntimeClient(ctx?: RuntimeContext): BedrockAgentRuntimeClient {
  return new BedrockAgentRuntimeClient(baseConfig(ctx));
}

export { LOCALSTACK_ENDPOINT, REGION, CREDENTIALS };
