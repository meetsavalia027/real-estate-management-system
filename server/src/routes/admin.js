/** Increment 4 — Admin moderation, flagged/duplicate handling, users and reports. */
const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { HttpError, wrap, toInt, trimOrNull, notify, mapProperty, publicUser } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const STATUS_FILTERS = ['pending', 'approved', 'rejected', 'sold', 'rented'];

// ---------- Listing moderation ----------
router.get('/properties', (req, res) => {
  const where = [];
  const params = [];
  const { status } = req.query;
  if (status === 'duplicate') where.push("p.is_duplicate_suspect = 1 AND p.status = 'pending'");
  else if (STATUS_FILTERS.includes(status)) { where.push('p.status = ?'); params.push(status); }
  const q = trimOrNull(req.query.q);
  if (q) { where.push('(p.title LIKE ? OR p.city LIKE ? OR p.locality LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  const rows = db.all(
    `SELECT p.*, u.name AS owner_name, u.role AS owner_role,
            (SELECT url FROM property_images i WHERE i.property_id = p.id ORDER BY i.sort_order, i.id LIMIT 1) AS cover_image,
            (SELECT COUNT(*) FROM flags f WHERE f.property_id = p.id AND f.status = 'open') AS open_flags
       FROM properties p JOIN users u ON u.id = p.owner_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY (p.status = 'pending') DESC, p.created_at DESC, p.id DESC LIMIT 200`,
    params,
  );
  const counts = Object.fromEntries(db.all('SELECT status, COUNT(*) AS n FROM properties GROUP BY status').map((r) => [r.status, r.n]));
  counts.duplicate = db.get("SELECT COUNT(*) AS n FROM properties WHERE is_duplicate_suspect = 1 AND status = 'pending'").n;
  res.json({
    counts,
    items: rows.map((r) => mapProperty(r, { owner: { name: r.owner_name, role: r.owner_role }, openFlags: r.open_flags })),
  });
});

router.patch('/properties/:id', wrap((req, res) => {
  const p = db.get('SELECT * FROM properties WHERE id = ?', [toInt(req.params.id)]);
  if (!p) throw new HttpError(404, 'Listing not found.');
  const { action } = req.body;

  if (action === 'approve') {
    if (!['pending', 'rejected'].includes(p.status)) throw new HttpError(400, 'Only pending or rejected listings can be approved.');
    db.run("UPDATE properties SET status = 'approved', rejection_reason = NULL, is_duplicate_suspect = 0, updated_at = datetime('now') WHERE id = ?", [p.id]);
    notify(p.owner_id, 'listing_approved', `Your listing "${p.title}" is now live.`, `/properties/${p.id}`);
  } else if (action === 'reject') {
    const reason = trimOrNull(req.body.reason);
    if (!reason) throw new HttpError(400, 'Give a reason so the owner knows what to fix.', { reason: 'Reason is required.' });
    if (!['pending', 'approved'].includes(p.status)) throw new HttpError(400, 'Only pending or live listings can be rejected.');
    db.run("UPDATE properties SET status = 'rejected', rejection_reason = ?, updated_at = datetime('now') WHERE id = ?", [reason, p.id]);
    notify(p.owner_id, 'listing_rejected', `Your listing "${p.title}" was not approved: ${reason}`, '/dashboard');
  } else {
    throw new HttpError(400, 'Action must be approve or reject.');
  }
  res.json({ property: mapProperty(db.get('SELECT * FROM properties WHERE id = ?', [p.id])) });
}));

// ---------- Reported listings ----------
router.get('/flags', (req, res) => {
  const status = ['open', 'resolved', 'dismissed'].includes(req.query.status) ? req.query.status : 'open';
  const rows = db.all(
    `SELECT f.*, p.title, p.city, p.locality, p.status AS property_status, u.name AS reporter_name, o.name AS owner_name
       FROM flags f
       JOIN properties p ON p.id = f.property_id
       JOIN users u ON u.id = f.reporter_id
       JOIN users o ON o.id = p.owner_id
      WHERE f.status = ? ORDER BY f.created_at DESC, f.id DESC`,
    [status],
  );
  res.json({
    status,
    items: rows.map((f) => ({
      id: f.id,
      reason: f.reason,
      details: f.details,
      status: f.status,
      createdAt: f.created_at,
      reporter: f.reporter_name,
      property: { id: f.property_id, title: f.title, city: f.city, locality: f.locality, status: f.property_status, ownerName: f.owner_name },
    })),
  });
});

router.patch('/flags/:id', wrap((req, res) => {
  const f = db.get('SELECT f.*, p.title, p.owner_id FROM flags f JOIN properties p ON p.id = f.property_id WHERE f.id = ?', [toInt(req.params.id)]);
  if (!f) throw new HttpError(404, 'Report not found.');
  const { action } = req.body;
  if (!['resolve', 'dismiss'].includes(action)) throw new HttpError(400, 'Action must be resolve or dismiss.');

  db.transaction(() => {
    if (action === 'dismiss') {
      db.run("UPDATE flags SET status = 'dismissed' WHERE id = ?", [f.id]);
      return;
    }
    // Resolve: take the listing down and close every open report on it
    const reason = `Removed after a report (${f.reason.replace('_', ' ')}).`;
    db.run("UPDATE properties SET status = 'rejected', rejection_reason = ?, updated_at = datetime('now') WHERE id = ?", [reason, f.property_id]);
    db.run("UPDATE flags SET status = 'resolved' WHERE property_id = ? AND status = 'open'", [f.property_id]);
    notify(f.owner_id, 'listing_rejected', `Your listing "${f.title}" was taken down after a report. Edit it and resubmit if the information was wrong.`, '/dashboard');
  });
  res.json({ message: action === 'dismiss' ? 'Report dismissed.' : 'Listing taken down and report resolved.' });
}));

// ---------- Users ----------
router.get('/users', (req, res) => {
  const params = [];
  let where = '';
  if (req.query.role) { where = 'WHERE u.role = ?'; params.push(req.query.role); }
  const rows = db.all(
    `SELECT u.*, (SELECT COUNT(*) FROM properties p WHERE p.owner_id = u.id) AS listings
       FROM users u ${where} ORDER BY u.created_at DESC, u.id DESC`,
    params,
  );
  res.json({ items: rows.map((u) => ({ ...publicUser(u), listings: u.listings })) });
});

router.patch('/users/:id', wrap((req, res) => {
  const u = db.get('SELECT * FROM users WHERE id = ?', [toInt(req.params.id)]);
  if (!u) throw new HttpError(404, 'User not found.');
  if (u.id === req.user.id) throw new HttpError(400, 'You cannot suspend your own account.');
  const active = req.body.isActive ? 1 : 0;
  db.run('UPDATE users SET is_active = ? WHERE id = ?', [active, u.id]);
  res.json({ user: publicUser(db.get('SELECT * FROM users WHERE id = ?', [u.id])) });
}));

// ---------- Reports ----------
router.get('/reports', (req, res) => {
  const group = (sql) => db.all(sql).map((r) => ({ label: r.label, value: r.value }));
  const lastDays = (table) => {
    const rows = db.all(`SELECT date(created_at) AS d, COUNT(*) AS n FROM ${table} WHERE created_at >= date('now','-6 days') GROUP BY d`);
    const map = Object.fromEntries(rows.map((r) => [r.d, r.n]));
    const out = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      out.push({ date: d, value: map[d] || 0 });
    }
    return out;
  };

  const enq = db.get(`SELECT COUNT(*) AS total,
                             SUM(CASE WHEN status IN ('replied','closed') THEN 1 ELSE 0 END) AS answered
                        FROM enquiries`);
  res.json({
    totals: {
      users: db.get("SELECT COUNT(*) AS n FROM users WHERE role != 'admin'").n,
      listings: db.get('SELECT COUNT(*) AS n FROM properties').n,
      live: db.get("SELECT COUNT(*) AS n FROM properties WHERE status = 'approved'").n,
      pending: db.get("SELECT COUNT(*) AS n FROM properties WHERE status = 'pending'").n,
      enquiries: enq.total || 0,
      responseRate: enq.total ? Math.round(((enq.answered || 0) / enq.total) * 100) : 0,
      openFlags: db.get("SELECT COUNT(*) AS n FROM flags WHERE status = 'open'").n,
      views: db.get('SELECT COALESCE(SUM(views),0) AS n FROM properties').n,
    },
    usersByRole: group("SELECT role AS label, COUNT(*) AS value FROM users WHERE role != 'admin' GROUP BY role ORDER BY value DESC"),
    listingsByStatus: group('SELECT status AS label, COUNT(*) AS value FROM properties GROUP BY status ORDER BY value DESC'),
    listingsByCity: group("SELECT city AS label, COUNT(*) AS value FROM properties WHERE status = 'approved' GROUP BY LOWER(city) ORDER BY value DESC LIMIT 8"),
    listingsByType: group("SELECT property_type AS label, COUNT(*) AS value FROM properties WHERE status = 'approved' GROUP BY property_type ORDER BY value DESC"),
    newListings: lastDays('properties'),
    newEnquiries: lastDays('enquiries'),
    topViewed: db.all("SELECT id, title, city, views FROM properties WHERE status = 'approved' ORDER BY views DESC LIMIT 5"),
  });
});

module.exports = router;
