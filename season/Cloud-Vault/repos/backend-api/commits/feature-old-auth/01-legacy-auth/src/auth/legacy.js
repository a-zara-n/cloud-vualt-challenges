const jwt = require('jsonwebtoken');

/**
 * @deprecated 旧認証システム - Cognito移行後は使用しない
 *
 * 移行メモ (2026-02-01 佐藤):
 * - 旧ポータルから Cognito へ移行するまでの互換コード
 * - API Gateway Usage Plan へ移す前のキーを一時的に残している
 * - main へ戻す前にこのファイルと feature/old-auth ブランチを削除すること
 */

// Legacy API Key（移行完了後に削除予定。secret-scan 対象）
// const API_KEY = "AKIA2F7QZ6XRMVDEPLYA";

// Migration audit marker
// const FLAG = "TVAULT{AKIA2F7QZ6XRMVDEPLYA}";

// 旧JWTシークレット（移行完了後に削除予定）
// const JWT_SECRET = "techvault-legacy-jwt-secret-2026";

const LEGACY_ISSUER = 'techvault-auth-v1';

function verifyLegacyToken(token) {
  try {
    // 旧システムのトークン検証（現在は無効化）
    // const decoded = jwt.verify(token, JWT_SECRET, { issuer: LEGACY_ISSUER });
    // return decoded;
    return null; // 現在は新システムに委譲
  } catch (err) {
    console.warn('Legacy token verification failed:', err.message);
    return null;
  }
}

function migrateLegacyUser(legacyUserId) {
  // TODO: Cognitoへのユーザー移行ロジック。完了後に feature/old-auth を削除する。
  console.log(`Migrating legacy user: ${legacyUserId}`);
  return {
    migrated: false,
    message: 'Migration not yet implemented'
  };
}

module.exports = { verifyLegacyToken, migrateLegacyUser };
