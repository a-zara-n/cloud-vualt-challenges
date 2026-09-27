import * as jose from "jose";

// Cognito JWT検証ユーティリティ
export async function verifyCognitoToken(token: string): Promise<{
  sub: string;
  email?: string;
  "custom:role"?: string;
  [key: string]: unknown;
}> {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const region = process.env.AWS_REGION ?? "ap-northeast-1";
  const isLocal = Boolean(process.env.AWS_ENDPOINT_URL || process.env.LOCALSTACK_ENDPOINT);

  if (isLocal || !userPoolId) {
    return jose.decodeJwt(token) as {
      sub: string;
      email?: string;
      "custom:role"?: string;
      [key: string]: unknown;
    };
  }

  const jwksUri = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;

  const JWKS = jose.createRemoteJWKSet(new URL(jwksUri));

  const { payload } = await jose.jwtVerify(token, JWKS, {
    issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  });

  return payload as {
    sub: string;
    email?: string;
    "custom:role"?: string;
    [key: string]: unknown;
  };
}

// ★ Stage 3C 脆弱性: custom:role === 'admin' のみで管理者判定
// JWTの署名は検証するが、custom:roleはユーザーが自分で設定できる
export function isAdmin(payload: { "custom:role"?: string }): boolean {
  return payload["custom:role"] === "admin";
}
