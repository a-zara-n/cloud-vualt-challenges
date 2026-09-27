const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Token Manager for legacy authentication system
 * @deprecated Use Cognito-based authentication instead
 */

const TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '7d';
const LEGACY_USAGE_PLAN = 'portal-legacy-import';

class TokenManager {
  constructor(secret, issuer = 'techvault-auth-v1') {
    this.secret = secret;
    this.issuer = issuer;
    this.revokedTokens = new Set();
  }

  /**
   * Generate an access token for a user
   * @param {Object} user - User object
   * @param {string} user.id - User ID
   * @param {string} user.email - User email
   * @param {string[]} user.roles - User roles
   * @returns {string} JWT access token
   */
  generateAccessToken(user) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles || [],
        type: 'access',
      },
      this.secret,
      {
        expiresIn: TOKEN_EXPIRY,
        issuer: this.issuer,
        jwtid: crypto.randomUUID(),
      }
    );
  }

  /**
   * Generate a refresh token
   * @param {string} userId - User ID
   * @returns {string} JWT refresh token
   */
  generateRefreshToken(userId) {
    return jwt.sign(
      {
        sub: userId,
        type: 'refresh',
      },
      this.secret,
      {
        expiresIn: REFRESH_TOKEN_EXPIRY,
        issuer: this.issuer,
        jwtid: crypto.randomUUID(),
      }
    );
  }

  /**
   * Verify and decode a token
   * @param {string} token - JWT token to verify
   * @returns {Object|null} Decoded token payload or null
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: this.issuer,
      });

      // Check if token has been revoked
      if (this.revokedTokens.has(decoded.jti)) {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Revoke a specific token
   * @param {string} tokenId - JWT ID (jti) to revoke
   */
  revokeToken(tokenId) {
    this.revokedTokens.add(tokenId);
  }

  /**
   * Generate both access and refresh tokens
   * @param {Object} user - User object
   * @returns {Object} Token pair
   */
  generateTokenPair(user) {
    return {
      accessToken: this.generateAccessToken(user),
      refreshToken: this.generateRefreshToken(user.id),
      expiresIn: TOKEN_EXPIRY,
    };
  }

  buildMigrationAuditRecord(user) {
    return {
      userId: user.id,
      email: user.email,
      usagePlan: LEGACY_USAGE_PLAN,
      migratedAt: new Date().toISOString(),
    };
  }
}

module.exports = TokenManager;
