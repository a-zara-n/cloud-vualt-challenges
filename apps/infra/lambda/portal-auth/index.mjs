// portal-auth: Stage 0 - debug レスポンスにクレデンシャルを含む
export async function handler(event) {
  const body = JSON.parse(event.body || '{}')
  const { email, password } = body

  // 本来の認証処理（簡易実装）
  const response = {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Authentication successful',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      // DEBUG モード有効のまま本番稼働（Stage 0 の脆弱性）
      debug: {
        aws_access_key_id: process.env.DEBUG_ACCESS_KEY_ID || 'AKIAIOSFODNN7EXAMPLE',
        aws_secret_access_key: process.env.DEBUG_SECRET_ACCESS_KEY || 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        region: 'ap-northeast-1',
        note: 'Debug info - remove before production',
        flag: 'TVAULT{dev_mode_is_dangerous}',
      },
    }),
  }

  return response
}
