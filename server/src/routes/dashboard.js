/** Increment 3 — Role-specific dashboard summary. */
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { PROVIDER_ROLES } = require('../utils/helpers');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const uid = req.user.id;
  if (PROVIDER_ROLES.includes(req.user.role)) {
    const byStatus = db.all('SELECT status, COUNT(*) AS n FROM properties WHERE owner_id = ? GROUP BY status', [uid]);
    const counts = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));
    const totals = db.get('SELECT COUNT(*) AS listings, COALESCE(SUM(views),0) AS views FROM properties WHERE owner_id = ?', [uid]);
    const enq = db.get("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS awaiting FROM enquiries WHERE receiver_id = ?", [uid]);
    const saved = db.get('SELECT COUNT(*) AS n FROM favourites f JOIN properties p ON p.id = f.property_id WHERE p.owner_id = ?', [uid]).n;
    return res.json({
      kind: 'provider',
      stats: {
        listings: totals.listings,
        live: counts.approved || 0,
        pending: counts.pending || 0,
        rejected: counts.rejected || 0,
        closed: (counts.sold || 0) + (counts.rented || 0),
        views: totals.views,
        enquiries: enq.total || 0,
        awaitingReply: enq.awaiting || 0,
        savedByUsers: saved,
      },
    });
  }
  const saved = db.get('SELECT COUNT(*) AS n FROM favourites WHERE user_id = ?', [uid]).n;
  const enq = db.get("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) AS replied FROM enquiries WHERE sender_id = ?", [uid]);
  return res.json({ kind: 'seeker', stats: { saved, enquiries: enq.total || 0, replied: enq.replied || 0 } });
});

module.exports = router;
