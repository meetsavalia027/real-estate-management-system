/** Increment 3 — Favourites / shortlist. */
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { HttpError, wrap, toInt, mapProperty } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.all(
    `SELECT p.*, f.created_at AS saved_at,
            (SELECT url FROM property_images i WHERE i.property_id = p.id ORDER BY i.sort_order, i.id LIMIT 1) AS cover_image
       FROM favourites f JOIN properties p ON p.id = f.property_id
      WHERE f.user_id = ? ORDER BY f.created_at DESC`,
    [req.user.id],
  );
  res.json({ items: rows.map((r) => mapProperty(r, { isFavourite: true, savedAt: r.saved_at })) });
});

router.post('/:propertyId', wrap((req, res) => {
  const p = db.get("SELECT id FROM properties WHERE id = ? AND status = 'approved'", [toInt(req.params.propertyId)]);
  if (!p) throw new HttpError(404, 'Listing not found.');
  db.run('INSERT OR IGNORE INTO favourites (user_id, property_id) VALUES (?, ?)', [req.user.id, p.id]);
  res.status(201).json({ isFavourite: true });
}));

router.delete('/:propertyId', (req, res) => {
  db.run('DELETE FROM favourites WHERE user_id = ? AND property_id = ?', [req.user.id, toInt(req.params.propertyId)]);
  res.json({ isFavourite: false });
});

module.exports = router;
