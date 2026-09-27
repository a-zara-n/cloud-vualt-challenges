import { NextResponse } from "next/server";
import {
  ListUserPoolClientsCommand,
  ListUserPoolsCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createCognitoClient } from "@/lib/cognito-client";

const localstackEndpoint =
  process.env.AWS_ENDPOINT_URL ??
  process.env.LOCALSTACK_ENDPOINT ??
  "http://127.0.0.1:4566";
const region =
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";

async function resolveLocalCognitoConfig() {
  const client = createCognitoClient({ region, endpoint: localstackEndpoint });

  const pools = await client.send(new ListUserPoolsCommand({ MaxResults: 10 }));
  const pool = pools.UserPools?.find((candidate) =>
    candidate.Name?.includes("TechVaultEmployeePool"),
  );

  if (!pool?.Id) return null;

  const clients = await client.send(
    new ListUserPoolClientsCommand({
      UserPoolId: pool.Id,
      MaxResults: 10,
    }),
  );
  const appClient = clients.UserPoolClients?.find((candidate) =>
    candidate.ClientName?.includes("techvault-portal-client"),
  );

  if (!appClient?.ClientId) return null;

  return {
    userPoolId: pool.Id,
    clientId: appClient.ClientId,
    region,
  };
}

// ★ Stage 3C 脆弱性: Cognito設定を認証なしで公開
// UserPool IDとClient IDが分かると、攻撃者は自分でユーザー登録でき、
// custom:role などのカスタム属性を自分で設定できる
export async function GET() {
  const configuredUserPoolId = process.env.COGNITO_USER_POOL_ID;
  const configuredClientId = process.env.COGNITO_CLIENT_ID;
  const localConfig = localstackEndpoint
    ? await resolveLocalCognitoConfig().catch(() => null)
    : null;

  return NextResponse.json({
    cognito: configuredUserPoolId && configuredClientId ? {
      userPoolId: configuredUserPoolId,
      clientId: configuredClientId,
      region,
    } : localConfig ?? {
      userPoolId: "ap-northeast-1_XXXXXXXX",
      clientId: "xxxxxxxxxxxxxxxxxxxxxxxxxx",
      region,
    },
    // ★ 追加情報漏洩: カスタム属性の名前も公開
    customAttributes: [
      { name: "custom:role", type: "String", mutable: true },
      { name: "custom:department", type: "String", mutable: true },
    ],
    verificationEndpoint: "/api/auth/verify",
    note: "For SDK integration. Do not share externally.",
  });
}
