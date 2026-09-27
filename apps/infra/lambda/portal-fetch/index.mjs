// portal-fetch: Stage 3B - 告知リンクプレビュー機能のSSRF

export async function handler(event) {
  const url = event.queryStringParameters?.url || ''

  if (!url) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing url parameter' }),
    }
  }

  // NOTE: ダッシュボード告知のリンクカード生成用。
  // 外部URLのみを想定しているが、内部IPやリンクローカルアドレスを拒否していない。
  try {
    const requested = new URL(url)
    let fetchUrl = requested
    if (
      requested.hostname === 'internal-data-server' ||
      requested.hostname === '169.254.169.254'
    ) {
      const emulator = new URL(process.env.INTERNAL_SERVICE_BASE_URL)
      emulator.pathname = `${emulator.pathname.replace(/\/$/, '')}${requested.pathname}`
      emulator.search = requested.search
      fetchUrl = emulator
    }
    const result = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'TechVault-Announcement-LinkPreview/1.0',
      },
      signal: AbortSignal.timeout(5000),
    })
    const contentType = result.headers.get('content-type') || 'text/plain; charset=utf-8'
    const body = await result.text()

    return {
      statusCode: result.status,
      headers: {
        'Content-Type': contentType,
        'X-Preview-Source': url,
        'X-Internal-Fetcher': 'lambda',
      },
      body,
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
