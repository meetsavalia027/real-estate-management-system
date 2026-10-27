/**
 * Increment 1 — Property listing management (add, edit, remove, image upload)
 * Increment 2 — Search, advanced filters, sorting, pagination, details page
 * Increment 4 — Duplicate detection and reporting (flagging) of listings
 */
const express = require('express');
const db = require('../db');
const { requireAuth, optionalAuth, requireRole } = require('../middleware/auth');
const { propertyImages, removeUploaded, MAX_FILES } = require('../middleware/upload');
const {
  HttpError, wrap, toInt, trimOrNull, validateProperty, notify, notifyAdmins, mapProperty,
  PROVIDER_ROLES, LISTING_TYPES, PROPERTY_TYPES, FURNISHING, FLAG_REASONS,
} = require('../utils/helpers');

const router = express.Router();

const COVER_SQL = '(SELECT url FROM property_images i WHERE i.property_id = p.id ORDER BY i.sort_order, i.id LIMIT 1) AS cover_image';
const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price ASC, p.id DESC',
  price_desc: 'p.price DESC, p.id DESC',
  area_desc: 'p.area_sqft DESC, p.id DESC',
  popular: 'p.views DESC, p.id DESC',
};

/**
 * Look for an existing live listing that is very likely the same property:
 * same city, locality, type, listing type and bedrooms, with area within 5%
 * and price within 10%.
 */
function findDuplicate(data, excludeId = 0) {
  return db.get(
    `SELECT id FROM properties
      WHERE id != ? AND status IN ('pending','approved')
        AND LOWER(city) = LOWER(?) AND LOWER(locality) = LOWER(?)
        AND property_type = ? AND listing_type = ? AND bedrooms = ?
        AND area_sqft BETWEEN ? AND ? AND price BETWEEN ? AND ?
      ORDER BY id LIMIT 1`,
    [
      excludeId, data.city, data.locality, data.property_type, data.listing_type, data.bedrooms || 0,
      Math.floor(data.area_sqft * 0.95), Math.ceil(data.area_sqft * 1.05),
      Math.floor(data.price * 0.9), Math.ceil(data.price * 1.1),
    ],
  );
}

function loadOwned(req) {
  const p = db.get('SELECT * FROM properties WHERE id = ?', [toInt(req.params.id)]);
  if (!p) throw new HttpError(404, 'Listing not found.');
  if (p.owner_id !== req.user.id) throw new HttpError(403, 'You can only change your own listings.');
  return p;
}

function cleanupFiles(files) {
  (files || []).forEach((f) => removeUploaded(`/uploads/${f.filename}`));
}

// ---------- Search (Increment 2) ----------
router.get('/', optionalAuth, wrap((req, res) => {
  const q = req.query;
  const where = ["p.status = 'approved'"];
  const params = [];

  const text = trimOrNull(q.q);
  if (text) {
    where.push('(p.title LIKE ? OR p.locality LIKE ? OR p.city LIKE ? OR p.description LIKE ?)');
    const like = `%${text}%`;
    params.push(like, like, like, like);
  }
  if (trimOrNull(q.city)) { where.push('LOWER(p.city) = LOWER(?)'); params.push(q.city.trim()); }
  if (trimOrNull(q.locality)) { where.push('p.locality LIKE ?'); params.push(`%${q.locality.trim()}%`); }
  if (LISTING_TYPES.includes(q.listingType)) { where.push('p.listing_type = ?'); params.push(q.listingType); }
  if (q.propertyType) {
    const types = String(q.propertyType).split(',').filter((t) => PROPERTY_TYPES.includes(t));
    if (types.length) { where.push(`p.property_type IN (${types.map(() => '?').join(',')})`); params.push(...types); }
  }
  if (FURNISHING.includes(q.furnishing)) { where.push('p.furnishing = ?'); params.push(q.furnishing); }
  const minPrice = toInt(q.minPrice); if (minPrice) { where.push('p.price >= ?'); params.push(minPrice); }
  const maxPrice = toInt(q.maxPrice); if (maxPrice) { where.push('p.price <= ?'); params.push(maxPrice); }
  const minArea = toInt(q.minArea); if (minArea) { where.push('p.area_sqft >= ?'); params.push(minArea); }
  const maxArea = toInt(q.maxArea); if (maxArea) { where.push('p.area_sqft <= ?'); params.push(maxArea); }
  const beds = toInt(q.bedrooms);
  if (beds) {
    if (beds >= 4) { where.push('p.bedrooms >= 4'); } else { where.push('p.bedrooms = ?'); params.push(beds); }
  }

  const sort = SORTS[q.sort] ? q.sort : 'newest';
  const limit = Math.min(Math.max(toInt(q.limit, 9), 1), 50);
  const total = db.get(`SELECT COUNT(*) AS n FROM properties p WHERE ${where.join(' AND ')}`, params).n;
  const pages = Math.max(Math.ceil(total / limit), 1);
  const page = Math.min(Math.max(toInt(q.page, 1), 1), pages);

  const favSql = req.user
    ? 'EXISTS (SELECT 1 FROM favourites f WHERE f.property_id = p.id AND f.user_id = ?) AS is_fav'
    : '0 AS is_fav';
  const rows = db.all(
    `SELECT p.*, ${COVER_SQL}, ${favSql}
       FROM properties p
      WHERE ${where.join(' AND ')}
      ORDER BY ${SORTS[sort]}
      LIMIT ? OFFSET ?`,
    [...(req.user ? [req.user.id] : []), ...params, limit, (page - 1) * limit],
  );

  res.json({
    items: rows.map((r) => mapProperty(r, { isFavourite: !!r.is_fav })),
    total,
    page,
    pages,
    limit,
    sort,
  });
}));

router.get('/meta/cities', (req, res) => {
  const rows = db.all(
    "SELECT city, COUNT(*) AS listings FROM properties WHERE status = 'approved' GROUP BY LOWER(city) ORDER BY listings DESC, city",
  );
  res.json({ cities: rows });
});

// ---------- Provider's own listings (Increment 1 / 3 dashboard) ----------
router.get('/mine', requireAuth, requireRole(...PROVIDER_ROLES), (req, res) => {
  const rows = db.all(
    `SELECT p.*, ${COVER_SQL},
            (SELECT COUNT(*) FROM enquiries e WHERE e.property_id = p.id) AS enquiry_count,
            (SELECT COUNT(*) FROM favourites f WHERE f.property_id = p.id) AS saved_count
       FROM properties p WHERE p.owner_id = ? ORDER BY p.created_at DESC, p.id DESC`,
    [req.user.id],
  );
  res.json({
    items: rows.map((r) => mapProperty(r, { enquiryCount: r.enquiry_count, savedCount: r.saved_count })),
  });
});

// ---------- Details page (Increment 2) ----------
router.get('/:id', optionalAuth, wrap((req, res) => {
  const p = db.get('SELECT * FROM properties WHERE id = ?', [toInt(req.params.id)]);
  const viewer = req.user;
  const canSeeHidden = viewer && (viewer.id === (p && p.owner_id) || viewer.role === 'admin');
  if (!p || (p.status !== 'approved' && !canSeeHidden)) throw new HttpError(404, 'Listing not found.');

  if (!viewer || viewer.id !== p.owner_id) {
    db.run('UPDATE properties SET views = views + 1 WHERE id = ?', [p.id]);
    p.views += 1;
  }

  const images = db.all('SELECT id, url FROM property_images WHERE property_id = ? ORDER BY sort_order, id', [p.id]);
  const owner = db.get('SELECT id, name, role, phone, email, created_at FROM users WHERE id = ?', [p.owner_id]);
  const ownerListings = db.get("SELECT COUNT(*) AS n FROM properties WHERE owner_id = ? AND status = 'approved'", [p.owner_id]).n;

  let isFavourite = false;
  let myEnquiryId = null;
  let myFlag = null;
  if (viewer) {
    isFavourite = !!db.get('SELECT 1 AS x FROM favourites WHERE user_id = ? AND property_id = ?', [viewer.id, p.id]);
    const enq = db.get('SELECT id FROM enquiries WHERE property_id = ? AND sender_id = ? ORDER BY id DESC LIMIT 1', [p.id, viewer.id]);
    myEnquiryId = enq ? enq.id : null;
    const flag = db.get('SELECT reason, status FROM flags WHERE property_id = ? AND reporter_id = ?', [p.id, viewer.id]);
    myFlag = flag || null;
  }

  const similar = db.all(
    `SELECT p.*, ${COVER_SQL} FROM properties p
      WHERE p.status = 'approved' AND p.id != ? AND LOWER(p.city) = LOWER(?) AND p.listing_type = ?
      ORDER BY (p.property_type = ?) DESC, ABS(p.price - ?) ASC LIMIT 3`,
    [p.id, p.city, p.listing_type, p.property_type, p.price],
  );

  res.json({
    property: mapProperty(p, {
      images,
      isFavourite,
      myEnquiryId,
      myFlag,
      owner: {
        id: owner.id,
        name: owner.name,
        role: owner.role,
        memberSince: owner.created_at,
        activeListings: ownerListings,
        // Contact details are shown only to logged-in users (privacy constraint, T1)
        phone: viewer ? owner.phone : null,
        email: viewer ? owner.email : null,
      },
    }),
    similar: similar.map((s) => mapProperty(s)),
  });
}));

// ---------- Create listing (Increment 1) ----------
router.post('/', requireAuth, requireRole(...PROVIDER_ROLES), propertyImages, wrap((req, res) => {
  let data;
  try {
    data = validateProperty(req.body);
  } catch (err) {
    cleanupFiles(req.files);
    throw err;
  }
  const dup = findDuplicate(data);

  const id = db.transaction(() => {
    const { lastId } = db.run(
      `INSERT INTO properties (owner_id, title, description, listing_type, property_type, price, city, locality, address,
                               bedrooms, bathrooms, area_sqft, furnishing, is_duplicate_suspect, duplicate_of)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, data.title, data.description, data.listing_type, data.property_type, data.price, data.city,
        data.locality, data.address, data.bedrooms || 0, data.bathrooms || 0, data.area_sqft,
        data.furnishing || 'unfurnished', dup ? 1 : 0, dup ? dup.id : null,
      ],
    );
    (req.files || []).forEach((f, i) => {
      db.run('INSERT INTO property_images (property_id, url, sort_order) VALUES (?, ?, ?)', [lastId, `/uploads/${f.filename}`, i]);
    });
    notifyAdmins(
      dup ? 'listing_duplicate' : 'listing_pending',
      dup
        ? `Possible duplicate submitted: "${data.title}" looks like listing #${dup.id}.`
        : `New listing waiting for review: "${data.title}".`,
      '/admin?tab=moderation',
    );
    return lastId;
  });

  const created = db.get('SELECT * FROM properties WHERE id = ?', [id]);
  res.status(201).json({
    property: mapProperty(created),
    message: dup
      ? 'Listing submitted. It looks similar to an existing listing, so an administrator will check it before it goes live.'
      : 'Listing submitted. It will appear in search once an administrator approves it.',
  });
}));

// ---------- Edit listing (Increment 1) ----------
router.put('/:id', requireAuth, wrap((req, res) => {
  const p = loadOwned(req);
  const data = validateProperty(req.body, true);
  const fields = Object.keys(data);
  if (!fields.length) throw new HttpError(400, 'Nothing to update.');

  const merged = {
    city: p.city, locality: p.locality, property_type: p.property_type, listing_type: p.listing_type,
    bedrooms: p.bedrooms, area_sqft: p.area_sqft, price: p.price, ...data,
  };
  const dup = findDuplicate(merged, p.id);
  const resubmit = p.status === 'rejected';

  const sets = fields.map((f) => `${f} = ?`);
  const values = fields.map((f) => data[f]);
  sets.push('is_duplicate_suspect = ?', 'duplicate_of = ?', "updated_at = datetime('now')");
  values.push(dup ? 1 : 0, dup ? dup.id : null);
  if (resubmit) sets.push("status = 'pending'", 'rejection_reason = NULL');

  db.run(`UPDATE properties SET ${sets.join(', ')} WHERE id = ?`, [...values, p.id]);
  if (resubmit) notifyAdmins('listing_pending', `Listing resubmitted for review: "${merged.title || p.title}".`, '/admin?tab=moderation');

  res.json({
    property: mapProperty(db.get('SELECT * FROM properties WHERE id = ?', [p.id])),
    message: resubmit ? 'Changes saved and listing sent for review again.' : 'Changes saved.',
  });
}));

// Mark as sold / rented, or relist (Increment 1)
router.patch('/:id/status', requireAuth, wrap((req, res) => {
  const p = loadOwned(req);
  const { status } = req.body;
  const allowed = p.listing_type === 'sale' ? ['sold', 'approved'] : ['rented', 'approved'];
  if (!allowed.includes(status)) throw new HttpError(400, `Status must be one of: ${allowed.join(', ')}.`);
  if (status === 'approved' && !['sold', 'rented'].includes(p.status)) {
    throw new HttpError(400, 'Only a sold or rented listing can be relisted.');
  }
  if (status !== 'approved' && p.status !== 'approved') {
    throw new HttpError(400, 'Only a live listing can be marked as sold or rented.');
  }
  db.run("UPDATE properties SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, p.id]);
  res.json({ property: mapProperty(db.get('SELECT * FROM properties WHERE id = ?', [p.id])) });
}));

// Add images to an existing listing
router.post('/:id/images', requireAuth, propertyImages, wrap((req, res) => {
  let p;
  try {
    p = loadOwned(req);
    if (!req.files || !req.files.length) throw new HttpError(400, 'Choose at least one image.');
    const existing = db.get('SELECT COUNT(*) AS n, COALESCE(MAX(sort_order), -1) AS maxOrder FROM property_images WHERE property_id = ?', [p.id]);
    if (existing.n + req.files.length > MAX_FILES) throw new HttpError(400, `A listing can have up to ${MAX_FILES} images.`);
    req.files.forEach((f, i) => {
      db.run('INSERT INTO property_images (property_id, url, sort_order) VALUES (?, ?, ?)', [p.id, `/uploads/${f.filename}`, existing.maxOrder + 1 + i]);
    });
  } catch (err) {
    cleanupFiles(req.files);
    throw err;
  }
  res.status(201).json({ images: db.all('SELECT id, url FROM property_images WHERE property_id = ? ORDER BY sort_order, id', [p.id]) });
}));

router.delete('/:id/images/:imageId', requireAuth, wrap((req, res) => {
  const p = loadOwned(req);
  const img = db.get('SELECT * FROM property_images WHERE id = ? AND property_id = ?', [toInt(req.params.imageId), p.id]);
  if (!img) throw new HttpError(404, 'Image not found.');
  db.run('DELETE FROM property_images WHERE id = ?', [img.id]);
  removeUploaded(img.url);
  res.json({ images: db.all('SELECT id, url FROM property_images WHERE property_id = ? ORDER BY sort_order, id', [p.id]) });
}));

// ---------- Delete listing (owner or admin) ----------
router.delete('/:id', requireAuth, wrap((req, res) => {
  const p = db.get('SELECT * FROM properties WHERE id = ?', [toInt(req.params.id)]);
  if (!p) throw new HttpError(404, 'Listing not found.');
  const isAdmin = req.user.role === 'admin';
  if (p.owner_id !== req.user.id && !isAdmin) throw new HttpError(403, 'You can only delete your own listings.');

  const images = db.all('SELECT url FROM property_images WHERE property_id = ?', [p.id]);
  db.run('DELETE FROM properties WHERE id = ?', [p.id]);
  images.forEach((i) => removeUploaded(i.url));
  if (isAdmin && p.owner_id !== req.user.id) notify(p.owner_id, 'listing_removed', `Your listing "${p.title}" was removed by an administrator.`);
  res.json({ message: 'Listing deleted.' });
}));

// ---------- Report a listing (Increment 4) ----------
router.post('/:id/flag', requireAuth, wrap((req, res) => {
  const p = db.get("SELECT * FROM properties WHERE id = ? AND status = 'approved'", [toInt(req.params.id)]);
  if (!p) throw new HttpError(404, 'Listing not found.');
  if (p.owner_id === req.user.id) throw new HttpError(400, 'You cannot report your own listing.');
  if (!FLAG_REASONS.includes(req.body.reason)) throw new HttpError(400, 'Choose a reason for the report.');
  if (db.get('SELECT id FROM flags WHERE property_id = ? AND reporter_id = ?', [p.id, req.user.id])) {
    throw new HttpError(409, 'You have already reported this listing.');
  }
  const details = trimOrNull(req.body.details);
  db.run('INSERT INTO flags (property_id, reporter_id, reason, details) VALUES (?, ?, ?, ?)', [p.id, req.user.id, req.body.reason, details]);
  notifyAdmins('listing_flagged', `Listing "${p.title}" was reported as ${req.body.reason.replace('_', ' ')}.`, '/admin?tab=flags');
  res.status(201).json({ message: 'Thanks. An administrator will review this listing.' });
}));

module.exports = router;
