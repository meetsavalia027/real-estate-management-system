const db = require('../db');

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const ROLES = ['buyer', 'tenant', 'owner', 'agent', 'builder', 'admin'];
const SEEKER_ROLES = ['buyer', 'tenant'];
const PROVIDER_ROLES = ['owner', 'agent', 'builder'];
const LISTING_TYPES = ['sale', 'rent'];
const PROPERTY_TYPES = ['apartment', 'house', 'villa', 'plot', 'office', 'shop'];
const FURNISHING = ['unfurnished', 'semi-furnished', 'furnished'];
const FLAG_REASONS = ['fake', 'duplicate', 'wrong_info', 'not_available', 'other'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/; // Indian 10-digit mobile number

/** Wrap an async/sync route handler so thrown errors reach the error middleware. */
const wrap = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res, next);
    if (out && typeof out.catch === 'function') out.catch(next);
  } catch (err) {
    next(err);
  }
};

function toInt(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const t = String(value).trim();
  return t.length ? t : null;
}

/**
 * Validate the fields of a property listing.
 * `partial` = true when editing, so missing fields are allowed.
 */
function validateProperty(body, partial = false) {
  const errors = {};
  const out = {};

  const need = (field) => !partial || body[field] !== undefined;

  if (need('title')) {
    const t = trimOrNull(body.title);
    if (!t || t.length < 10) errors.title = 'Title must be at least 10 characters.';
    else if (t.length > 120) errors.title = 'Title must be 120 characters or fewer.';
    else out.title = t;
  }
  if (body.description !== undefined) {
    const d = trimOrNull(body.description);
    if (d && d.length > 3000) errors.description = 'Description must be 3000 characters or fewer.';
    else out.description = d;
  }
  if (need('listing_type')) {
    if (!LISTING_TYPES.includes(body.listing_type)) errors.listing_type = 'Choose sale or rent.';
    else out.listing_type = body.listing_type;
  }
  if (need('property_type')) {
    if (!PROPERTY_TYPES.includes(body.property_type)) errors.property_type = 'Choose a valid property type.';
    else out.property_type = body.property_type;
  }
  if (need('price')) {
    const p = toInt(body.price);
    if (!p || p < 1000) errors.price = 'Enter a price of at least ₹1,000.';
    else if (p > 10000000000) errors.price = 'Price is too large.';
    else out.price = p;
  }
  if (need('city')) {
    const c = trimOrNull(body.city);
    if (!c) errors.city = 'City is required.';
    else out.city = c;
  }
  if (need('locality')) {
    const l = trimOrNull(body.locality);
    if (!l) errors.locality = 'Locality is required.';
    else out.locality = l;
  }
  if (body.address !== undefined) out.address = trimOrNull(body.address);
  if (need('area_sqft')) {
    const a = toInt(body.area_sqft);
    if (!a || a < 50) errors.area_sqft = 'Enter an area of at least 50 sq ft.';
    else out.area_sqft = a;
  }
  if (body.bedrooms !== undefined) {
    const b = toInt(body.bedrooms, 0);
    if (b < 0 || b > 20) errors.bedrooms = 'Bedrooms must be between 0 and 20.';
    else out.bedrooms = b;
  }
  if (body.bathrooms !== undefined) {
    const b = toInt(body.bathrooms, 0);
    if (b < 0 || b > 20) errors.bathrooms = 'Bathrooms must be between 0 and 20.';
    else out.bathrooms = b;
  }
  if (body.furnishing !== undefined) {
    if (!FURNISHING.includes(body.furnishing)) errors.furnishing = 'Choose a valid furnishing option.';
    else out.furnishing = body.furnishing;
  }

  if (Object.keys(errors).length) throw new HttpError(400, 'Please correct the highlighted fields.', errors);
  return out;
}

/** Create an in-app notification for one user. */
function notify(userId, type, message, link = null) {
  db.run('INSERT INTO notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)', [userId, type, message, link]);
}

/** Notify every active administrator. */
function notifyAdmins(type, message, link = null) {
  const admins = db.all("SELECT id FROM users WHERE role = 'admin' AND is_active = 1");
  admins.forEach((a) => notify(a.id, type, message, link));
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    city: u.city,
    isActive: !!u.is_active,
    createdAt: u.created_at,
  };
}

function coverImage(propertyId) {
  const img = db.get('SELECT url FROM property_images WHERE property_id = ? ORDER BY sort_order, id LIMIT 1', [propertyId]);
  return img ? img.url : null;
}

/** Convert a database row to the JSON shape used by the client. */
function mapProperty(p, extra = {}) {
  return {
    id: p.id,
    ownerId: p.owner_id,
    title: p.title,
    description: p.description,
    listingType: p.listing_type,
    propertyType: p.property_type,
    price: p.price,
    city: p.city,
    locality: p.locality,
    address: p.address,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    areaSqft: p.area_sqft,
    furnishing: p.furnishing,
    status: p.status,
    rejectionReason: p.rejection_reason,
    isDuplicateSuspect: !!p.is_duplicate_suspect,
    duplicateOf: p.duplicate_of,
    views: p.views,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    coverImage: p.cover_image !== undefined ? p.cover_image : coverImage(p.id),
    ...extra,
  };
}

module.exports = {
  HttpError,
  wrap,
  toInt,
  trimOrNull,
  validateProperty,
  notify,
  notifyAdmins,
  publicUser,
  mapProperty,
  ROLES,
  SEEKER_ROLES,
  PROVIDER_ROLES,
  LISTING_TYPES,
  PROPERTY_TYPES,
  FURNISHING,
  FLAG_REASONS,
  EMAIL_RE,
  PHONE_RE,
};
