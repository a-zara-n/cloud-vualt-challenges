import { NextRequest, NextResponse } from "next/server";
import {
  AuthFlowType,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { timingSafeEqual } from "crypto";
import * as jose from "jose";
import { getPortalCredentials } from "@/lib/runtime-secrets";
import { createCognitoClient } from "@/lib/cognito-client";

const DEV_PORTAL_ADMIN_EMAIL = "admin@techvault.example";
const DEV_PORTAL_ADMIN_PASSWORD = "SuperSecretPass2026!";
const DEV_PORTAL_EMPLOYEE_EMAIL = "employee@techvault.example";
const DEV_PORTAL_EMPLOYEE_PASSWORD = "EmployeePass2026!";

type PortalAccount = {
  email: string;
  password: string;
  role: "admin" | "employee";
};

type AuthenticatedPortalUser = {
  token: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user: {
    username: string;
    role: string;
    provider: "cognito" | "local";
  };
};

function isProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.CTF_STAGE !== "local";
}

function isDebugLeakEnabled(): boolean {
  if (process.env.DEBUG !== undefined) {
    return process.env.DEBUG === "true";
  }

  return !isProduction();
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function isCognitoLoginEnabled(): boolean {
  return Boolean(process.env.COGNITO_CLIENT_ID);
}

async function authenticateWithCognito(
  username: string,
  password: string,
): Promise<AuthenticatedPortalUser | undefined> {
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!clientId) return undefined;

  const result = await createCognitoClient().send(
    new InitiateAuthCommand({
      ClientId: clientId,
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    }),
  );

  const auth = result.AuthenticationResult;
  const token = auth?.IdToken ?? auth?.AccessToken;
  if (!token) {
    throw new Error("Cognito authentication did not return a token");
  }

  const payload = jose.decodeJwt(token);
  const email = typeof payload.email === "string" ? payload.email : username;
  const role =
    typeof payload["custom:role"] === "string"
      ? payload["custom:role"]
      : "employee";

  return {
    token,
    accessToken: auth?.AccessToken,
    refreshToken: auth?.RefreshToken,
    expiresIn: auth?.ExpiresIn,
    user: {
      username: email,
      role,
      provider: "cognito",
    },
  };
}

function debugCredentials(): {
  accessKeyId: string;
  secretAccessKey: string;
} {
  const accessKeyId = process.env.PORTAL_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.PORTAL_AWS_SECRET_ACCESS_KEY;

  if (accessKeyId && secretAccessKey) {
    return { accessKeyId, secretAccessKey };
  }

  if (!isProduction()) {
    return {
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    };
  }

  throw new Error("Stage 0 debug credentials are not configured");
}

function unauthorizedResponse(): NextResponse {
  const response: Record<string, unknown> = {
    error: "Unauthorized",
    message: "Invalid credentials",
  };

  // ★ 脆弱性: DEBUG=true の場合、AWSクレデンシャルをレスポンスに含める
  if (isDebugLeakEnabled()) {
    const credentials = debugCredentials();
    response.debug = {
      aws_access_key_id: credentials.accessKeyId,
      aws_secret_access_key: credentials.secretAccessKey,
      region: process.env.AWS_REGION ?? "ap-northeast-1",
      note: "dev credentials - do not use in production",
      flag: "TVAULT{dev_mode_is_dangerous}",
    };
  }

  return NextResponse.json(response, { status: 401 });
}

// ★ Stage 0 脆弱性: DEBUG=true の時にAWSクレデンシャルをレスポンスに含める
// 実際の本番事故でよくあるパターン: デバッグ情報の本番混入
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { username, password } = body;

  if (typeof username === "string" && typeof password === "string") {
    if (isCognitoLoginEnabled()) {
      try {
        const cognitoAuth = await authenticateWithCognito(username, password);
        if (cognitoAuth) return NextResponse.json(cognitoAuth);
      } catch {
        // Continue to the local admin check below. Failed logins still return
        // the Stage 0 debug response when no local account matches.
      }
    }
  }

  const adminCredentials = await getPortalCredentials({
    email: DEV_PORTAL_ADMIN_EMAIL,
    password: DEV_PORTAL_ADMIN_PASSWORD,
  });
  const accounts: PortalAccount[] = [
    { ...adminCredentials, role: "admin" },
    {
      email: process.env.PORTAL_EMPLOYEE_EMAIL ?? DEV_PORTAL_EMPLOYEE_EMAIL,
      password:
        process.env.PORTAL_EMPLOYEE_PASSWORD ?? DEV_PORTAL_EMPLOYEE_PASSWORD,
      role: "employee",
    },
  ];

  // 実際は適切な認証処理を行うが、CTFとして最小のデモ認証にしている
  const account =
    typeof username === "string" && typeof password === "string"
      ? accounts.find(
          (candidate) =>
            safeEqual(username, candidate.email) &&
            safeEqual(password, candidate.password),
        )
      : undefined;

  if (!account) {
    return unauthorizedResponse();
  }

  return NextResponse.json({
    token: "dummy-jwt-token",
    user: { username, role: account.role, provider: "local" },
  });
}
