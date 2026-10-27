/**
 * Login rate limiting (security fix for audit finding NC-04 / CAPA CA-04 in T11).
 * After MAX_FAILURES failed logins for the same email from the same IP within
 * WINDOW_MS, further attempts are blocked until the window passes.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const attempts = new Map(); // key -> { count, first }

function keyFor(req) {
  const email = String((req.body && req.body.email) || '').toLowerCase().trim();
  return `${req.ip}|${email}`;
}

function loginLimiter(req, res, next) {
  const key = keyFor(req);
  const entry = attempts.get(key);
  if (entry && Date.now() - entry.first > WINDOW_MS) attempts.delete(key);
  const current = attempts.get(key);
  if (current && current.count >= MAX_FAILURES) {
    const waitMin = Math.ceil((WINDOW_MS - (Date.now() - current.first)) / 60000);
    return res.status(429).json({
      error: `Too many failed login attempts. Try again in ${waitMin} minute${waitMin === 1 ? '' : 's'}.`,
    });
  }
  req.loginKey = key;
  next();
}

function recordFailure(key) {
  const entry = attempts.get(key);
  if (!entry) attempts.set(key, { count: 1, first: Date.now() });
  else entry.count += 1;
}

function clearFailures(key) {
  attempts.delete(key);
}

function resetAll() {
  attempts.clear();
}

module.exports = { loginLimiter, recordFailure, clearFailures, resetAll, MAX_FAILURES };
