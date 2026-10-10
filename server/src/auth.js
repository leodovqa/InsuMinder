const crypto = require('crypto');

const AUTH_SECRET = process.env.AUTH_SECRET || 'insuminder-dev-auth-secret-key-2026';
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = 'sha256';

/**
 * Validate email format with standard regex
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  // Standard RFC 5322 compliant regex for practical email validation
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) return false;

  // Domain checks
  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  if (!domain.includes('.')) return false;
  const domainParts = domain.split('.');
  if (domainParts.some(p => p.length === 0)) return false;
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2) return false;

  // Disallow explicit test dummy/invalid domain formats that cannot receive emails
  if (domain.endsWith('.invalid') || domain.endsWith('.fail') || domain === 'localhost') {
    return false;
  }

  return true;
}

/**
 * Hash password using PBKDF2-SHA256
 * @param {string} password
 * @returns {string}
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify password against stored PBKDF2 hash
 * @param {string} password
 * @param {string} storedHash
 * @returns {boolean}
 */
function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const iterations = parseInt(parts[1], 10);
  const salt = parts[2];
  const originalKeyHex = parts[3];

  const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST);
  return crypto.timingSafeEqual(Buffer.from(derivedKey.toString('hex')), Buffer.from(originalKeyHex));
}

/**
 * Generate a 6-digit numeric verification code
 * @returns {string}
 */
function generateVerificationCode() {
  const num = crypto.randomInt(100000, 1000000);
  return String(num);
}

/**
 * Create a signed session token
 * @param {object} user
 * @param {string} [secret]
 * @returns {string}
 */
function createSessionToken(user, secret = AUTH_SECRET) {
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name || '',
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days validity
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

/**
 * Verify session token and return decoded payload
 * @param {string} token
 * @param {string} [secret]
 * @returns {object|null}
 */
function verifySessionToken(token, secret = AUTH_SECRET) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadStr, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Express middleware to authenticate token
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : req.headers['x-auth-token'];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please sign in.' });
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: 'Session expired or invalid. Please sign in again.' });
  }

  req.user = { id: payload.userId, email: payload.email, name: payload.name };
  next();
}

/**
 * Express optional auth middleware (attaches user if valid token present)
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : req.headers['x-auth-token'];

  if (token) {
    const payload = verifySessionToken(token);
    if (payload) {
      req.user = { id: payload.userId, email: payload.email, name: payload.name };
    }
  }
  next();
}
/**
 * Middleware to resolve effective user ID (supports switching between personal and shared data)
 */
function resolveContext(req, res, next) {
  if (!req.user || !req.user.id) {
    req.effectiveUserId = null;
    return next();
  }

  const contextHeader = req.headers['x-active-context'] || req.query.context;
  const ownerIdHeader = req.headers['x-active-owner-id'] || req.query.ownerId;

  if (contextHeader === 'shared' && ownerIdHeader) {
    const ownerId = parseInt(ownerIdHeader, 10);
    if (!isNaN(ownerId)) {
      const db = require('./db');
      db.isSharedMember(ownerId, req.user.id, (err, isMember) => {
        if (!err && isMember) {
          req.effectiveUserId = ownerId;
          req.isSharedContext = true;
          req.sharedOwnerId = ownerId;
          return next();
        }
        req.effectiveUserId = req.user.id;
        req.isSharedContext = false;
        next();
      });
      return;
    }
  }

  req.effectiveUserId = req.user.id;
  req.isSharedContext = false;
  next();
}

module.exports = {
  AUTH_SECRET,
  isValidEmail,
  hashPassword,
  verifyPassword,
  generateVerificationCode,
  createSessionToken,
  verifySessionToken,
  requireAuth,
  optionalAuth,
  resolveContext
};


