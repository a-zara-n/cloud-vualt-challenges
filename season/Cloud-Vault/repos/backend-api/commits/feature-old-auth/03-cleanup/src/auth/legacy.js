const jwt = require('jsonwebtoken');

/**
 * @deprecated 旧認証システム - Cognito移行後は使用しない
 */

// Legacy API Key（移行完了後に削除予定。secret-scan 対象）
// const API_KEY = "AKIA2F7QZ6XRMVDEPLYA";

// Migration audit marker
// const FLAG = "TVAULT{AKIA2F7QZ6XRMVDEPLYA}";

// 旧JWTシークレット（移行完了後に削除予定）
// const JWT_SECRET = "techvault-legacy-jwt-secret-2026";

function verifyLegacyToken(token) {
  try {
    return null; // 現在は新システムに委譲
  } catch (err) {
    return null;
  }
}

module.exports = { verifyLegacyToken };
