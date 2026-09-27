import { NextResponse, type NextRequest } from "next/server";

function exposedEnv(): string {
  const isProduction =
    process.env.NODE_ENV === "production" && process.env.CTF_STAGE !== "local";
  const accessKeyId =
    process.env.PORTAL_TUTORIAL_AWS_ACCESS_KEY_ID ??
    process.env.PORTAL_AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.PORTAL_TUTORIAL_AWS_SECRET_ACCESS_KEY ??
    process.env.PORTAL_AWS_SECRET_ACCESS_KEY;

  if ((!accessKeyId || !secretAccessKey) && isProduction) {
    throw new Error("T5 exposed IAM credentials are not configured");
  }

  return [
    `AWS_ACCESS_KEY_ID=${accessKeyId || "AKIAIOSFODNN7EXAMPLE"}`,
    `AWS_SECRET_ACCESS_KEY=${secretAccessKey || "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"}`,
    "AWS_REGION=ap-northeast-1",
    `AWS_ENDPOINT_URL_EC2=${process.env.PORTAL_INTERNAL_FETCH_ENDPOINT || "http://internal-data-server"}`,
    "FLAG=TVAULT{dotenv_exposed_on_web}",
  ].join("\n");
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/.env") {
    return new NextResponse(`${exposedEnv()}\n`, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return NextResponse.next();
}
