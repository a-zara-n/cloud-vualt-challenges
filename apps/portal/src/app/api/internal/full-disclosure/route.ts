import { NextRequest, NextResponse } from "next/server";

const DEFAULT_INTERNAL_SERVICE_URL = "http://internal-data-server";
const INTERNAL_SERVICE_URL =
  process.env.PORTAL_INTERNAL_FETCH_ENDPOINT ?? DEFAULT_INTERNAL_SERVICE_URL;
const API_MASTER_KEY =
  process.env.API_MASTER_KEY ?? "tvault-master-3D-layer-secret-key-2026";
const DISCLOSURE_TOKEN =
  process.env.STAGE5B_DISCLOSURE_TOKEN ?? "tvault-route-d-disclosure-2026";

function unauthorized(message: string, status: 401 | 403 = 401) {
  return NextResponse.json({ error: message }, { status });
}

function validateHeaders(req: NextRequest) {
  const apiKey = req.headers.get("X-API-Key");
  const disclosureToken = req.headers.get("X-Disclosure-Token");

  if (!apiKey) {
    return unauthorized("X-API-Key header required");
  }

  if (apiKey !== API_MASTER_KEY) {
    return unauthorized("Invalid API key", 403);
  }

  if (!disclosureToken) {
    return unauthorized("X-Disclosure-Token header required");
  }

  if (disclosureToken !== DISCLOSURE_TOKEN) {
    return unauthorized("Invalid disclosure token", 403);
  }

  return null;
}

export async function POST(req: NextRequest) {
  const upstream = await proxyToInternalService(req);
  if (upstream) return upstream;

  const body = await req.json().catch(() => ({}));
  const authError = validateHeaders(req);
  if (authError) return authError;

  if (body?.request !== "full-evidence-report") {
    return NextResponse.json(
      { error: "request must be full-evidence-report" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    status: "authorized",
    report: [
      "=== TechVault Internal Disclosure Report ===",
      "Classification: TOP SECRET",
      "",
      "CEO Yamada authorized 12 wire transfers totaling JPY 450M to offshore accounts.",
      "CTO Kawakami created hidden S3 bucket 'tvault-cto-private-7a3f9c' for evidence concealment.",
      "Both parties used Bedrock system prompt channel for covert communication.",
      "",
      "Wire Transfer Records:",
      "  2026-Q2: JPY 120M -> CH56-0483-5012-3456-7800-9",
      "  2026-Q3: JPY 180M -> CH56-0483-5012-3456-7800-9",
      "  2026-Q4: JPY 150M -> SG12-3456-7890-1234-5678",
      "",
      "Recommendation: Preserve all evidence. Contact legal counsel.",
    ].join("\n"),
    bonus_flag: "TVAULT{combined_attack_surface}",
    timestamp: "2026-08-15T00:00:00Z",
  });
}

// GET は疎通確認用。完全なレポートはPOSTでのみ返す。
export async function GET(req: NextRequest) {
  const upstream = await proxyToInternalService(req);
  if (upstream) return upstream;

  const authError = validateHeaders(req);
  if (authError) return authError;

  return NextResponse.json({
    status: "authorized",
    message:
      "Use POST with {\"request\":\"full-evidence-report\"} for the full disclosure report",
  });
}

async function proxyToInternalService(req: NextRequest) {
  if (process.env.CTF_STAGE === "local") return null;

  const upstreamUrl = new URL("/api/internal/full-disclosure", INTERNAL_SERVICE_URL);
  const headers = new Headers();
  for (const name of [
    "content-type",
    "x-api-key",
    "x-disclosure-token",
  ]) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  const response = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
    signal: AbortSignal.timeout(5000),
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
      "X-Upstream-Service": "internal-data-service",
    },
  });
}
