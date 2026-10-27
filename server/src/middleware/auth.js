const jwt = require('jsonwebtoken');
const db = require('../db');
const { HttpError } = require('../utils/helpers');

const JWT_SECRET = process.env.JWT_SECRET || 'rems-dev-secret-change-me';
const TOKEN_TTL = '7d';

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function readUser(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.get('SELECT * FROM users WHERE id = ?', [payload.sub]);
    if (!user || !user.is_active) return null;
    return user;
  } catch {
    return null;
  }
}

/** Requires a valid login. Sets req.user. */
function requireAuth(req, res, next) {
  const user = readUser(req);
  if (!user) return next(new HttpError(401, 'Please log in to continue.'));
  req.user = user;
  next();
}

/** Sets req.user if a valid token is sent, but does not require one. */
function optionalAuth(req, res, next) {
  req.user = readUser(req);
  next();
}

/** Allows only the listed roles. Use after requireAuth. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new HttpError(403, 'Your account type cannot do this.'));
    }
    next();
  };
}

module.exports = { signToken, requireAuth, optionalAuth, requireRole };
