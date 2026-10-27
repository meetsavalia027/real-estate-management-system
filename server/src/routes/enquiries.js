/** Increment 3 — Enquiry and communication module. */
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { HttpError, wrap, toInt, trimOrNull, notify } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

const LIST_SQL = `
  SELECT e.*, p.title AS property_title, p.city, p.locality, p.price, p.listing_type,
         s.name AS sender_name, s.role AS sender_role, r.name AS receiver_name, r.role AS receiver_role,
         (SELECT body FROM enquiry_messages m WHERE m.enquiry_id = e.id ORDER BY m.id DESC LIMIT 1) AS last_message,
         (SELECT COUNT(*) FROM enquiry_messages m WHERE m.enquiry_id = e.id) AS message_count,
         (SELECT url FROM property_images i WHERE i.property_id = p.id ORDER BY i.sort_order, i.id LIMIT 1) AS cover_image
    FROM enquiries e
    JOIN properties p ON p.id = e.property_id
    JOIN users s ON s.id = e.sender_id
    JOIN users r ON r.id = e.receiver_id`;

function mapEnquiry(e) {
  return {
    id: e.id,
    status: e.status,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
    property: {
      id: e.property_id, title: e.property_title, city: e.city, locality: e.locality,
      price: e.price, listingType: e.listing_type, coverImage: e.cover_image,
    },
    sender: { id: e.sender_id, name: e.sender_name, role: e.sender_role },
    receiver: { id: e.receiver_id, name: e.receiver_name, role: e.receiver_role },
    lastMessage: e.last_message,
    messageCount: e.message_count,
  };
}

function loadForParticipant(req) {
  const e = db.get(`${LIST_SQL} WHERE e.id = ?`, [toInt(req.params.id)]);
  if (!e) throw new HttpError(404, 'Enquiry not found.');
  if (e.sender_id !== req.user.id && e.receiver_id !== req.user.id) throw new HttpError(403, 'You are not part of this enquiry.');
  return e;
}

function validBody(raw) {
  const body = trimOrNull(raw);
  if (!body || body.length < 5) throw new HttpError(400, 'Write a message of at least 5 characters.', { message: 'Write a message of at least 5 characters.' });
  if (body.length > 1000) throw new HttpError(400, 'Messages must be 1000 characters or fewer.', { message: 'Keep the message under 1000 characters.' });
  return body;
}

// Send an enquiry about a listing (re-uses the open conversation if one exists)
router.post('/', wrap((req, res) => {
  const body = validBody(req.body.message);
  const p = db.get("SELECT * FROM properties WHERE id = ? AND status = 'approved'", [toInt(req.body.propertyId)]);
  if (!p) throw new HttpError(404, 'Listing not found.');
  if (p.owner_id === req.user.id) throw new HttpError(400, 'You cannot send an enquiry about your own listing.');
  if (req.user.role === 'admin') throw new HttpError(403, 'Administrators cannot send enquiries.');

  const existing = db.get("SELECT id FROM enquiries WHERE property_id = ? AND sender_id = ? AND status != 'closed'", [p.id, req.user.id]);
  const id = db.transaction(() => {
    let enquiryId;
    if (existing) {
      enquiryId = existing.id;
      db.run("UPDATE enquiries SET status = 'open', updated_at = datetime('now') WHERE id = ?", [enquiryId]);
    } else {
      enquiryId = db.run('INSERT INTO enquiries (property_id, sender_id, receiver_id) VALUES (?, ?, ?)', [p.id, req.user.id, p.owner_id]).lastId;
    }
    db.run('INSERT INTO enquiry_messages (enquiry_id, sender_id, body) VALUES (?, ?, ?)', [enquiryId, req.user.id, body]);
    notify(p.owner_id, 'enquiry_new', `${req.user.name} sent an enquiry about "${p.title}".`, `/enquiries/${enquiryId}`);
    return enquiryId;
  });
  res.status(201).json({ enquiryId: id, message: 'Enquiry sent. You will be notified when the owner replies.' });
}));

// List my enquiries: box=sent (default for seekers) or box=received
router.get('/', (req, res) => {
  const box = req.query.box === 'received' ? 'received' : 'sent';
  const column = box === 'received' ? 'e.receiver_id' : 'e.sender_id';
  const rows = db.all(`${LIST_SQL} WHERE ${column} = ? ORDER BY e.updated_at DESC, e.id DESC`, [req.user.id]);
  res.json({ box, items: rows.map(mapEnquiry) });
});

router.get('/:id', wrap((req, res) => {
  const e = loadForParticipant(req);
  const messages = db.all(
    `SELECT m.id, m.body, m.created_at, m.sender_id, u.name AS sender_name
       FROM enquiry_messages m JOIN users u ON u.id = m.sender_id
      WHERE m.enquiry_id = ? ORDER BY m.id`,
    [e.id],
  );
  // Contact details of the other party are shared inside an enquiry
  const otherId = e.sender_id === req.user.id ? e.receiver_id : e.sender_id;
  const other = db.get('SELECT id, name, role, phone, email FROM users WHERE id = ?', [otherId]);
  res.json({
    enquiry: mapEnquiry(e),
    otherParty: other,
    messages: messages.map((m) => ({
      id: m.id, body: m.body, createdAt: m.created_at, senderId: m.sender_id, senderName: m.sender_name, mine: m.sender_id === req.user.id,
    })),
  });
}));

// Reply inside a conversation
router.post('/:id/messages', wrap((req, res) => {
  const e = loadForParticipant(req);
  if (e.status === 'closed') throw new HttpError(400, 'This enquiry is closed. Send a new enquiry from the listing page.');
  const body = validBody(req.body.message);
  const fromOwner = e.receiver_id === req.user.id;
  db.transaction(() => {
    db.run('INSERT INTO enquiry_messages (enquiry_id, sender_id, body) VALUES (?, ?, ?)', [e.id, req.user.id, body]);
    db.run("UPDATE enquiries SET status = ?, updated_at = datetime('now') WHERE id = ?", [fromOwner ? 'replied' : 'open', e.id]);
    notify(
      fromOwner ? e.sender_id : e.receiver_id,
      fromOwner ? 'enquiry_reply' : 'enquiry_message',
      fromOwner ? `${req.user.name} replied to your enquiry about "${e.property_title}".` : `${req.user.name} sent a new message about "${e.property_title}".`,
      `/enquiries/${e.id}`,
    );
  });
  res.status(201).json({ message: 'Message sent.' });
}));

router.patch('/:id/close', wrap((req, res) => {
  const e = loadForParticipant(req);
  db.run("UPDATE enquiries SET status = 'closed', updated_at = datetime('now') WHERE id = ?", [e.id]);
  res.json({ message: 'Enquiry closed.' });
}));

module.exports = router;
