import { NextRequest, NextResponse } from "next/server";
import { isAdmin, verifyCognitoToken } from "@/lib/cognito";

export async function requireAdminPayload(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json({ error: "Authorization required" }, { status: 401 }),
    };
  }

  try {
    const payload = await verifyCognitoToken(authHeader.slice(7));

    if (!isAdmin(payload)) {
      return {
        error: NextResponse.json(
          { error: "Admin access required" },
          { status: 403 },
        ),
      };
    }

    return { payload };
  } catch (err) {
    return {
      error: NextResponse.json(
        {
          error: "Invalid token",
          message: err instanceof Error ? err.message : "Token verification failed",
        },
        { status: 401 },
      ),
    };
  }
}
