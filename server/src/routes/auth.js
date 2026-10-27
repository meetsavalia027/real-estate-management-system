/** Increment 1 — Authentication, authorization and profile management. */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const { loginLimiter, recordFailure, clearFailures } = require('../middleware/rateLimit');
const { HttpError, wrap, trimOrNull, publicUser, ROLES, EMAIL_RE, PHONE_RE } = require('../utils/helpers');

const router = express.Router();
const SELF_REGISTER_ROLES = ROLES.filter((r) => r !== 'admin');

router.post('/register', wrap((req, res) => {
  const name = trimOrNull(req.body.name);
  const email = (trimOrNull(req.body.email) || '').toLowerCase();
  const phone = trimOrNull(req.body.phone);
  const city = trimOrNull(req.body.city);
  const { password, role } = req.body;

  const errors = {};
  if (!name || name.length < 2) errors.name = 'Enter your full name.';
  if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';
  if (phone && !PHONE_RE.test(phone)) errors.phone = 'Enter a 10-digit mobile number.';
  if (!password || password.length < 8) errors.password = 'Password must be at least 8 characters.';
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) errors.password = 'Password must contain letters and numbers.';
  if (!SELF_REGISTER_ROLES.includes(role)) errors.role = 'Choose an account type.';
  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', errors);

  if (db.get('SELECT id FROM users WHERE email = ?', [email])) {
    throw new HttpError(409, 'An account with this email already exists.', { email: 'This email is already registered.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const { lastId } = db.run(
    'INSERT INTO users (name, email, phone, password_hash, role, city) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, phone, hash, role, city],
  );
  const user = db.get('SELECT * FROM users WHERE id = ?', [lastId]);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

router.post('/login', loginLimiter, wrap((req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  const user = db.get('SELECT * FROM users WHERE email = ?', [email]);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    recordFailure(req.loginKey);
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  if (!user.is_active) throw new HttpError(403, 'This account has been suspended. Contact the administrator.');

  clearFailures(req.loginKey);
  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.put('/me', requireAuth, wrap((req, res) => {
  const name = trimOrNull(req.body.name);
  const phone = trimOrNull(req.body.phone);
  const city = trimOrNull(req.body.city);
  const errors = {};
  if (!name || name.length < 2) errors.name = 'Enter your full name.';
  if (phone && !PHONE_RE.test(phone)) errors.phone = 'Enter a 10-digit mobile number.';
  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', errors);

  db.run('UPDATE users SET name = ?, phone = ?, city = ? WHERE id = ?', [name, phone, city, req.user.id]);
  res.json({ user: publicUser(db.get('SELECT * FROM users WHERE id = ?', [req.user.id])) });
}));

router.put('/me/password', requireAuth, wrap((req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!bcrypt.compareSync(String(currentPassword || ''), req.user.password_hash)) {
    throw new HttpError(400, 'Current password is incorrect.', { currentPassword: 'Current password is incorrect.' });
  }
  if (!newPassword || newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    throw new HttpError(400, 'New password must be at least 8 characters with letters and numbers.', {
      newPassword: 'Use at least 8 characters with letters and numbers.',
    });
  }
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), req.user.id]);
  res.json({ message: 'Password changed.' });
}));

module.exports = router;
