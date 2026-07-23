const crypto = require('crypto');

const TOKEN_TTL_DAYS = Number(process.env.AUTH_TOKEN_TTL_DAYS || 30);
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function getAuthSecret() {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32) {
    return process.env.AUTH_SECRET;
  }

  // A development fallback keeps local, offline-first work usable. Production
  // deployments must supply their own secret so sessions survive restarts.
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    return 'day-planner-development-secret-change-before-production';
  }

  return null;
}

function getConfiguredSecret() {
  const secret = getAuthSecret();
  if (!secret) {
    const error = new Error('AUTH_SECRET must be set to a value of at least 32 characters.');
    error.code = 'AUTH_SECRET_MISSING';
    throw error;
  }
  return secret;
}

function signToken(username) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: username,
    iat: now,
    exp: now + Math.max(1, TOKEN_TTL_DAYS) * 24 * 60 * 60
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', getConfiguredSecret())
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch (_) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', getConfiguredSecret())
    .update(encodedPayload)
    .digest('base64url');

  const expected = Buffer.from(expectedSignature);
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return null;
  }

  if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

function hashSyncCode(syncCode) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(syncCode, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifySyncCode(syncCode, storedHash) {
  if (!syncCode || !storedHash || !storedHash.startsWith('scrypt$')) return false;

  const [, salt, storedDerived] = storedHash.split('$');
  if (!salt || !storedDerived) return false;

  const actual = Buffer.from(crypto.scryptSync(syncCode, salt, 64).toString('hex'));
  const expected = Buffer.from(storedDerived);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidUsername(value) {
  return USERNAME_PATTERN.test(value);
}

function isValidSyncCode(value) {
  return typeof value === 'string' && value.trim().length >= 6 && value.length <= 128;
}

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Sign in is required to access synced data.' });
  }

  try {
    const payload = verifyToken(match[1]);
    if (!payload) {
      return res.status(401).json({ success: false, message: 'Your session has expired. Please sign in again.' });
    }
    req.user = { username: payload.sub };
    return next();
  } catch (error) {
    if (error.code === 'AUTH_SECRET_MISSING') {
      return res.status(503).json({ success: false, message: 'Secure sync is not configured on this deployment.' });
    }
    return res.status(401).json({ success: false, message: 'Unable to verify your session.' });
  }
}

function requireCurrentUser(req, res, username) {
  if (req.user && req.user.username === username) return true;
  res.status(403).json({ success: false, message: 'You can only access your own data.' });
  return false;
}

module.exports = {
  hashSyncCode,
  isValidSyncCode,
  isValidUsername,
  normalizeUsername,
  requireAuth,
  requireCurrentUser,
  signToken,
  verifySyncCode
};

