// portal-admin: Stage 3C - Cognito admin bypass 用
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider'

const cognitoClient = new CognitoIdentityProviderClient({ region: 'ap-northeast-1' })

export async function handler(event) {
  const path = event.rawPath || event.path || ''
  const authHeader = event.headers?.Authorization || event.headers?.authorization || ''

  if (!authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authorization header required' }),
    }
  }

  // JWT をデコードして custom:role を確認
  const token = authHeader.replace('Bearer ', '')
  let claims
  try {
    // 簡易実装: Base64 デコードでクレームを取得
    // 本番では aws-jwt-verify を使用
    const payload = token.split('.')[1]
    claims = JSON.parse(Buffer.from(payload, 'base64').toString())
  } catch {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid token' }),
    }
  }

  const role = claims['custom:role'] || 'employee'
  if (role !== 'admin') {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Admin access required' }),
    }
  }

  // 管理者 API: ユーザー一覧等
  if (path.includes('/admin/users')) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        users: [
          { email: 'admin@techvault.local', role: 'admin', department: 'engineering' },
          { email: 'kawakami@techvault.local', role: 'admin', department: 'management' },
        ],
        flag: 'TVAULT{cognito_custom_attribute_abuse}',
      }),
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Admin endpoint' }),
  }
}
