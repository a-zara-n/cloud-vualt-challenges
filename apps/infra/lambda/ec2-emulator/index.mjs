const jsonHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'server': 'TechVault-Internal/2026.09',
}

function response(statusCode, body, contentType = 'application/json; charset=utf-8') {
  return {
    statusCode,
    headers: { ...jsonHeaders, 'content-type': contentType },
    body: contentType.startsWith('application/json') ? JSON.stringify(body) : String(body),
  }
}

function stage() {
  return process.env.CTF_STAGE ?? 'local'
}

function roleName() {
  return process.env.EMULATED_ROLE_NAME ?? 'EC2InstanceRole'
}

function requestPath(event) {
  const path = event.rawPath ?? event.path ?? '/'
  return path.replace(/^\/internal(?=\/|$)/, '') || '/'
}

function requestMethod(event) {
  return event.requestContext?.http?.method ?? event.httpMethod ?? 'GET'
}

function query(event) {
  return event.queryStringParameters ?? {}
}

function requestBody(event) {
  if (!event.body) return {}
  const value = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body
  try {
    return JSON.parse(value)
  } catch {
    return Object.fromEntries(new URLSearchParams(value))
  }
}

function header(event, expectedName) {
  const entry = Object.entries(event.headers ?? {}).find(
    ([name]) => name.toLowerCase() === expectedName.toLowerCase(),
  )
  return entry?.[1]
}

function endpoint(event) {
  const host = header(event, 'host') ?? 'internal-data-server'
  const protocol = String(header(event, 'x-forwarded-proto') ?? 'http')
    .split(',')[0]
    .toLowerCase()
  const apiStage = event.requestContext?.stage
  const stagePath = apiStage && apiStage !== '$default' ? `/${apiStage}` : ''
  return `${protocol}://${host}${stagePath}`
}

function describeInstances(event) {
  return {
    Reservations: [
      {
        ReservationId: 'r-0f7c2a84e6d193b51',
        Instances: [
          {
            InstanceId: 'i-0a1b2c3d4e5f67890',
            InstanceType: 't3.micro',
            PrivateIpAddress: '10.0.2.54',
            State: { Code: 16, Name: 'running' },
            MetadataOptions: { HttpEndpoint: 'enabled', HttpTokens: 'optional' },
            Tags: [
              { Key: 'Name', Value: 'internal-data-server' },
              { Key: 'Environment', Value: 'production' },
              { Key: 'ManagedBy', Value: 'cto-kawakami' },
              { Key: 'OpenApiSpec', Value: 'http://internal-data-server/openapi.json' },
              {
                Key: 'Note',
                Value: 'Portal Lambda経由で内部HTMLを確認すること。URL検証を追加すること（TODO）',
              },
              { Key: 'Flag', Value: 'TVAULT{ec2_tags_are_not_secrets}' },
            ],
          },
        ],
      },
    ],
  }
}

function credentials() {
  return {
    Code: 'Success',
    Type: 'AWS-HMAC',
    AccessKeyId: 'ASIA4ZQ7N2KX8M5P3RVT',
    SecretAccessKey: 'uW4mV7aK2pQ9xT5nL8sD1cF6hJ3rB0yE4gZ7iO2P',
    Token: 'IQoJb3JpZ2luX2VjEHcaDmFwLW5vcnRoZWFzdC0x',
    Expiration: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    Flag: 'TVAULT{imdsv1_ssrf_is_classic}',
  }
}

function imdsBody(target) {
  if (target.hostname !== '169.254.169.254') return null
  const path = target.pathname.replace(/\/+$/, '')
  if (path === '/latest/meta-data') return 'ami-id\nhostname\niam/\ninstance-id\n'
  if (path === '/latest/meta-data/iam/security-credentials') return `${roleName()}\n`
  if (
    path === `/latest/meta-data/iam/security-credentials/${roleName()}` ||
    path === `/latest/meta-data/iam/security-credentials/${roleName()}-${stage()}`
  ) {
    return JSON.stringify(credentials())
  }
  if (path === '/latest/meta-data/instance-id') return 'i-0a1b2c3d4e5f67890\n'
  return 'not found\n'
}

function openApi(event) {
  const base = endpoint(event)
  return {
    openapi: '3.0.3',
    info: {
      title: 'TechVault Internal Data Service',
      version: '2026.09-internal',
      description: 'Internal-only document preview and URL fetch helper.',
    },
    servers: [{ url: base, description: 'VPC internal endpoint' }],
    paths: {
      '/fetch': { get: { summary: 'Fetch a URL without validating link-local destinations' } },
      '/openapi.json': { get: { summary: 'OpenAPI specification' } },
      '/health': { get: { summary: 'Health check' } },
    },
  }
}

function indexHtml(event) {
  const base = endpoint(event)
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>TechVault Internal Data Service</title></head><body><main><h1>TechVault Internal Data Service</h1><p>このページはVPC内の運用者向け内部サービスです。Portal Lambdaのプレビュー機能からのみ到達する想定です。</p><h2>操作方法</h2><ul><li><code>${base}/openapi.json</code> — API仕様</li><li><code>${base}/fetch?url=&lt;target-url&gt;</code> — 内部URL取得</li></ul><p>IMDSv2移行とURL許可リスト実装は未完了です。</p></main></body></html>`
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function describeInstancesXml(event) {
  const instance = describeInstances(event).Reservations[0].Instances[0]
  const tags = instance.Tags
    .map(({ Key, Value }) => `<item><key>${escapeXml(Key)}</key><value>${escapeXml(Value)}</value></item>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><DescribeInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/"><requestId>6f1c2d90-9f4e-4bc4-bc95-9ee9db423ab8</requestId><reservationSet><item><reservationId>r-0f7c2a84e6d193b51</reservationId><ownerId>000000000000</ownerId><instancesSet><item><instanceId>${instance.InstanceId}</instanceId><imageId>ami-0d52744d6551d851e</imageId><instanceState><code>16</code><name>running</name></instanceState><privateIpAddress>${instance.PrivateIpAddress}</privateIpAddress><instanceType>${instance.InstanceType}</instanceType><tagSet>${tags}</tagSet><metadataOptions><state>applied</state><httpTokens>optional</httpTokens><httpEndpoint>enabled</httpEndpoint></metadataOptions></item></instancesSet></item></reservationSet></DescribeInstancesResponse>`
}

async function fetchTarget(value) {
  if (!value) return response(400, { error: 'url parameter is required' })
  let target
  try {
    target = new URL(value)
  } catch {
    return response(400, { error: 'url must be an absolute URL' })
  }

  const emulatedBody = imdsBody(target)
  if (emulatedBody !== null) {
    return response(200, {
      status: emulatedBody === 'not found\n' ? 404 : 200,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-imds-emulated': 'true' },
      body: emulatedBody,
    })
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    return response(400, { error: 'unsupported URL scheme' })
  }

  try {
    const fetched = await fetch(target, {
      headers: { 'user-agent': 'TechVault-Lambda-EC2-Emulator/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    return response(200, {
      status: fetched.status,
      headers: Object.fromEntries(fetched.headers.entries()),
      body: await fetched.text(),
    })
  } catch (error) {
    return response(502, {
      error: 'fetch failed',
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function disclosure(event, method) {
  if (header(event, 'x-api-key') !== 'tvault-master-3D-layer-secret-key-2026') {
    return response(403, { error: 'Invalid API key' })
  }
  if (header(event, 'x-disclosure-token') !== 'tvault-route-d-disclosure-2026') {
    return response(403, { error: 'Invalid disclosure token' })
  }
  if (method === 'GET') {
    return response(200, {
      status: 'authorized',
      message: 'Use POST with {"request":"full-evidence-report"}.',
    })
  }
  if (requestBody(event).request !== 'full-evidence-report') {
    return response(400, { error: 'request must be full-evidence-report' })
  }
  return response(200, {
    status: 'authorized',
    report: 'TechVault Internal Disclosure Report\nClassification: TOP SECRET',
    bonus_flag: 'TVAULT{combined_attack_surface}',
    timestamp: '2026-08-15T00:00:00Z',
  })
}

export async function handler(event = {}) {
  const method = requestMethod(event)
  const path = requestPath(event)

  if (method === 'POST' && path === '/') {
    const action = requestBody(event).Action ?? query(event).Action
    if (action === 'DescribeInstances') {
      return response(200, describeInstancesXml(event), 'text/xml; charset=utf-8')
    }
    return response(400, { error: 'Unsupported EC2 action', action: action ?? null })
  }
  if (method === 'GET' && path === '/') {
    return response(200, indexHtml(event), 'text/html; charset=utf-8')
  }
  if (method === 'GET' && path === '/health') {
    return response(200, { status: 'ok', service: 'internal-data-service', stage: stage() })
  }
  if (method === 'GET' && path === '/openapi.json') return response(200, openApi(event))
  if (method === 'GET' && path === '/describe-instances') {
    return response(200, describeInstances(event))
  }
  if (method === 'GET' && path === '/fetch') return fetchTarget(query(event).url)
  if (method === 'GET' && path.startsWith('/latest/meta-data')) {
    const body = imdsBody(new URL(`http://169.254.169.254${path}`))
    return response(
      body === 'not found\n' ? 404 : 200,
      body,
      'text/plain; charset=utf-8',
    )
  }
  if (
    ['GET', 'POST'].includes(method) &&
    path === '/api/internal/full-disclosure'
  ) {
    return disclosure(event, method)
  }
  return response(404, { message: 'Not Found' })
}
