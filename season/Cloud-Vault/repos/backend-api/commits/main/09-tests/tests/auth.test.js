const jwt = require('jsonwebtoken');
const { authenticate, requireGroup } = require('../src/middleware/auth');

// Mock jwks-rsa
jest.mock('jwks-rsa', () => {
  return jest.fn(() => ({
    getSigningKey: jest.fn((kid, callback) => {
      callback(null, {
        getPublicKey: () => 'test-public-key',
      });
    }),
  }));
});

// Mock jsonwebtoken
jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should return 401 if no Authorization header', () => {
      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if Authorization header does not start with Bearer', () => {
      req.headers.authorization = 'Basic some-token';

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should set req.user and call next on valid token', () => {
      const mockDecoded = {
        sub: 'user-123',
        email: 'test@techvault.example',
        'cognito:groups': ['admin'],
        token_use: 'access',
      };

      jwt.verify.mockImplementation((token, getKey, options, callback) => {
        callback(null, mockDecoded);
      });

      req.headers.authorization = 'Bearer valid-token';

      authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual({
        sub: 'user-123',
        email: 'test@techvault.example',
        groups: ['admin'],
        tokenUse: 'access',
      });
    });

    it('should return 401 on invalid token', () => {
      jwt.verify.mockImplementation((token, getKey, options, callback) => {
        callback(new Error('invalid token'), null);
      });

      req.headers.authorization = 'Bearer invalid-token';

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized',
          message: 'Invalid or expired token',
        })
      );
    });

    it('should handle token with no groups', () => {
      const mockDecoded = {
        sub: 'user-456',
        email: 'nogroups@techvault.example',
        token_use: 'access',
      };

      jwt.verify.mockImplementation((token, getKey, options, callback) => {
        callback(null, mockDecoded);
      });

      req.headers.authorization = 'Bearer valid-token';

      authenticate(req, res, next);

      expect(req.user.groups).toEqual([]);
    });
  });

  describe('requireGroup', () => {
    it('should return 401 if no user on request', () => {
      const middleware = requireGroup('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user does not have required group', () => {
      req.user = {
        sub: 'user-123',
        groups: ['viewer'],
      };

      const middleware = requireGroup('admin');

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Forbidden',
        })
      );
    });

    it('should call next if user has required group', () => {
      req.user = {
        sub: 'user-123',
        groups: ['admin', 'editor'],
      };

      const middleware = requireGroup('admin');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should accept any of the allowed groups', () => {
      req.user = {
        sub: 'user-123',
        groups: ['editor'],
      };

      const middleware = requireGroup('admin', 'editor');

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
