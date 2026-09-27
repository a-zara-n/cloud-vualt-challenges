import { NextRequest, NextResponse } from "next/server";
import {
  AdminConfirmSignUpCommand,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createCognitoClient } from "@/lib/cognito-client";

function isAlreadyConfirmed(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  return name === "NotAuthorizedException" && message.includes("CONFIRMED");
}

// Stage 3C: 壊れた検証フロー。username だけでサインアップ済みユーザーを確認済みにできる。
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rawUsername =
    body && typeof body === "object" && "username" in body
      ? body.username
      : undefined;
  const username =
    typeof rawUsername === "string" ? rawUsername.trim() : "";

  if (!username) {
    return NextResponse.json(
      { error: "username is required" },
      { status: 400 },
    );
  }

  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  if (!userPoolId) {
    return NextResponse.json(
      { error: "Cognito user pool is not configured" },
      { status: 500 },
    );
  }

  const cognito = createCognitoClient();
  let status: "confirmed" | "already_confirmed" = "confirmed";

  try {
    await cognito.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: userPoolId,
        Username: username,
      }),
    );
  } catch (error) {
    if (!isAlreadyConfirmed(error)) {
      return NextResponse.json(
        {
          error: "verification failed",
          message:
            error instanceof Error ? error.message : "Cognito confirmation failed",
        },
        { status: 400 },
      );
    }
    status = "already_confirmed";
  }

  try {
    await cognito.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: username,
        UserAttributes: [{ Name: "email_verified", Value: "true" }],
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "email verification failed",
        message:
          error instanceof Error ? error.message : "Cognito attribute update failed",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    verified: true,
    status,
    username,
    note: "CTF verification endpoint accepted this user without an email code.",
  });
}
