/** Increment 4 — Notifications and enquiry-status alerts. */
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { toInt } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const items = db.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 30', [req.user.id]);
  const unread = db.get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]).n;
  res.json({
    unread,
    items: items.map((n) => ({ id: n.id, type: n.type, message: n.message, link: n.link, isRead: !!n.is_read, createdAt: n.created_at })),
  });
});

router.post('/read-all', (req, res) => {
  db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
  res.json({ unread: 0 });
});

router.patch('/:id/read', (req, res) => {
  db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [toInt(req.params.id), req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
