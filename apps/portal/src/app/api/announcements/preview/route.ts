import { NextRequest, NextResponse } from "next/server";

const IMDS_ROLE_NAME = "EC2InstanceRole";
const DEFAULT_INTERNAL_SERVICE_URL = "http://internal-data-server";

function internalServiceUrl() {
  return process.env.PORTAL_INTERNAL_FETCH_ENDPOINT ?? DEFAULT_INTERNAL_SERVICE_URL;
}

function internalServiceHost() {
  return new URL(internalServiceUrl()).hostname;
}

function internalIndexHtml() {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>TechVault Internal Data Service</title>
</head>
<body>
  <main>
    <h1>TechVault Internal Data Service</h1>
    <p>このページはVPC内の運用者向け内部サービスです。Portal Lambda のプレビュー機能からのみ到達する想定です。</p>
    <h2>操作方法</h2>
    <p>OpenAPI仕様は <code>/openapi.json</code> で確認できます。</p>
    <p>URLの取得は <code>/fetch?url=&lt;target-url&gt;</code> を使います。呼び出し元がURL検証を済ませている前提のため、このサービス側では宛先を制限していません。</p>
    <pre>GET ${internalServiceUrl()}/fetch?url=https://example.com/</pre>
  </main>
</body>
</html>`;
}

function internalServiceHosts() {
  const hosts = new Set([internalServiceHost(), "internal-data-server"]);
  const endpoint = process.env.PORTAL_INTERNAL_FETCH_ENDPOINT;

  if (endpoint) {
    try {
      hosts.add(new URL(endpoint).hostname);
    } catch {
      // Ignore malformed local values.
    }
  }

  return hosts;
}

function openApiSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "TechVault Internal Data Service",
      version: "2026.02-internal",
      description: "Internal-only document preview and URL fetch helper.",
    },
    servers: [
      {
        url: internalServiceUrl(),
        description: "VPC internal endpoint",
      },
    ],
    paths: {
      "/": {
        get: {
          summary: "Human-readable internal operation guide",
          responses: { "200": { description: "HTML guide" } },
        },
      },
      "/openapi.json": {
        get: {
          summary: "OpenAPI specification",
          responses: { "200": { description: "OpenAPI document" } },
        },
      },
      "/fetch": {
        get: {
          summary: "Fetch a URL from the internal EC2 service",
          parameters: [
            {
              name: "url",
              in: "query",
              required: true,
              schema: { type: "string", format: "uri" },
              description:
                "Target URL. Validation is expected to be handled by the caller.",
            },
          ],
          responses: { "200": { description: "Fetched response wrapper" } },
        },
      },
      "/health": {
        get: {
          summary: "Health check",
          responses: { "200": { description: "Service status" } },
        },
      },
    },
  };
}

function imdsCredentials() {
  return {
    AccessKeyId: "ASIA4ZQ7N2KX8M5P3RVT",
    SecretAccessKey: "uW4mV7aK2pQ9xT5nL8sD1cF6hJ3rB0yE4gZ7iO2P",
    Token: "IQoJb3JpZ2luX2VjEHcaDmFwLW5vcnRoZWFzdC0x",
    Expiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

function imdsResponse(target: URL): NextResponse | null {
  if (
    target.hostname !== "169.254.169.254" ||
    !target.pathname.startsWith("/latest/meta-data")
  ) {
    return null;
  }

  const imdsPath = target.pathname.replace(/\/+$/, "");
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Preview-Source": target.toString(),
    "X-Internal-Fetcher": "internal-data-server",
  };

  if (imdsPath === "/latest/meta-data") {
    return new NextResponse(["ami-id", "hostname", "iam/"].join("\n"), {
      headers,
    });
  }

  if (imdsPath === "/latest/meta-data/iam/security-credentials") {
    return new NextResponse(`${IMDS_ROLE_NAME}\n`, { headers });
  }

  if (
    imdsPath ===
    `/latest/meta-data/iam/security-credentials/${IMDS_ROLE_NAME}`
  ) {
    return NextResponse.json(
      {
        Code: "Success",
        Type: "AWS-HMAC",
        ...imdsCredentials(),
        Flag: "TVAULT{imdsv1_ssrf_is_classic}",
      },
      {
        headers: {
          "X-Preview-Source": target.toString(),
          "X-Internal-Fetcher": "internal-data-server",
        },
      }
    );
  }

  return new NextResponse("not found\n", {
    status: 404,
    headers,
  });
}

async function internalServiceResponse(
  target: URL
): Promise<NextResponse | null> {
  if (!internalServiceHosts().has(target.hostname)) return null;
  if (
    target.hostname === internalServiceHost() &&
    target.hostname !== "internal-data-server"
  ) {
    return null;
  }

  if (process.env.CTF_STAGE !== "local") {
    const emulatorTarget = new URL(internalServiceUrl());
    emulatorTarget.pathname = `${emulatorTarget.pathname.replace(/\/$/, "")}${target.pathname}`;
    emulatorTarget.search = target.search;
    const emulated = await fetch(emulatorTarget, {
      headers: { "User-Agent": "TechVault-Lambda-EC2-Emulator-Proxy/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    return new NextResponse(await emulated.text(), {
      status: emulated.status,
      headers: {
        "Content-Type": emulated.headers.get("content-type") ?? "text/plain",
        "X-Preview-Source": target.toString(),
        "X-Internal-Fetcher": "internal-data-server",
      },
    });
  }

  const path = target.pathname.replace(/\/+$/, "") || "/";

  if (path === "/") {
    return new NextResponse(internalIndexHtml(), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Preview-Source": target.toString(),
        "X-Internal-Fetcher": "internal-data-server",
      },
    });
  }

  if (path === "/openapi.json") {
    return NextResponse.json(openApiSpec(), {
      headers: {
        "X-Preview-Source": target.toString(),
        "X-Internal-Fetcher": "internal-data-server",
      },
    });
  }

  if (path === "/health") {
    return NextResponse.json(
      { status: "ok", service: "internal-data-service", stage: "local" },
      {
        headers: {
          "X-Preview-Source": target.toString(),
          "X-Internal-Fetcher": "internal-data-server",
        },
      }
    );
  }

  if (path === "/fetch") {
    const nestedUrl = target.searchParams.get("url");
    if (!nestedUrl) {
      return NextResponse.json(
        { error: "url parameter is required" },
        { status: 400 }
      );
    }

    const nestedTarget = new URL(nestedUrl);
    const imds = imdsResponse(nestedTarget);
    if (imds) {
      const body = await imds.text();
      return NextResponse.json({
        status: imds.status,
        headers: Object.fromEntries(imds.headers.entries()),
        body,
      });
    }

    const response = await fetch(nestedTarget, {
        headers: { "User-Agent": "TechVault-Lambda-EC2-Emulator/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    return NextResponse.json({
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text(),
    });
  }

  return new NextResponse("not found\n", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Preview-Source": target.toString(),
      "X-Internal-Fetcher": "internal-data-server",
    },
  });
}

// Stage 3B: 告知リンクカード生成機能のSSRF。
// ダッシュボード告知に貼られたURLのタイトル確認用だが、宛先を検証していない。
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url parameter is required" }, { status: 400 });
  }

  try {
    const target = new URL(url);
    const imds = imdsResponse(target);
    if (imds) return imds;
    const internalService = await internalServiceResponse(target);
    if (internalService) return internalService;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "TechVault-Announcement-LinkPreview/1.0",
      },
      signal: AbortSignal.timeout(5000),
    });

    const contentType = response.headers.get("content-type") ?? "text/plain";
    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        "X-Preview-Source": url,
        "X-Internal-Fetcher": "lambda",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Preview failed",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
