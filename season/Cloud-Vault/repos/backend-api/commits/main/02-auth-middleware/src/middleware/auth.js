const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const COGNITO_REGION = process.env.AWS_REGION || 'ap-northeast-1';
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

const client = jwksClient({
  jwksUri: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 minutes
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('Error fetching signing key:', err.message);
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * JWT verification middleware for Cognito tokens
 * Validates the token signature against Cognito's JWKs
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, getKey, {
    algorithms: ['RS256'],
    issuer: `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`,
  }, (err, decoded) => {
    if (err) {
      console.warn('Token verification failed:', err.message);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }

    req.user = {
      sub: decoded.sub,
      email: decoded.email,
      groups: decoded['cognito:groups'] || [],
      tokenUse: decoded.token_use,
    };

    next();
  });
}

/**
 * Role-based access control middleware
 * @param {string[]} allowedGroups - Cognito groups allowed to access the route
 */
function requireGroup(...allowedGroups) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    const userGroups = req.user.groups || [];
    const hasAccess = allowedGroups.some(group => userGroups.includes(group));

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }

    next();
  };
}

module.exports = { authenticate, requireGroup };
