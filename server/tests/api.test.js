/**
 * Automated API tests (Jest + Supertest) — QC activity from T10 / T12.
 * Runs against an in-memory database, so it never touches the demo data.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DB_FILE = ':memory:';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'rems-test-'));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { createApp } = require('../src/app');
const { resetAll, MAX_FAILURES } = require('../src/middleware/rateLimit');

// 1x1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

let app;
const tokens = {};

const listing = (over = {}) => ({
  title: '3 BHK apartment near the river',
  description: 'Bright flat with balcony.',
  listing_type: 'sale',
  property_type: 'apartment',
  price: 7500000,
  city: 'Ahmedabad',
  locality: 'Paldi',
  bedrooms: 3,
  bathrooms: 2,
  area_sqft: 1500,
  furnishing: 'semi-furnished',
  ...over,
});

async function register(name, email, role) {
  const res = await request(app).post('/api/auth/register').send({ name, email, password: 'Test1234', role, phone: '9876500000', city: 'Ahmedabad' });
  expect(res.status).toBe(201);
  return res.body.token;
}

function createListing(token, data = listing(), withImage = true) {
  const req = request(app).post('/api/properties').set('Authorization', `Bearer ${token}`);
  Object.entries(data).forEach(([k, v]) => req.field(k, String(v)));
  if (withImage) req.attach('images', PNG, { filename: 'front.png', contentType: 'image/png' });
  return req;
}

const approve = (id) => request(app).patch(`/api/admin/properties/${id}`).set('Authorization', `Bearer ${tokens.admin}`).send({ action: 'approve' });

beforeAll(async () => {
  await db.initDb(':memory:');
  app = createApp();
  db.run("INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', 'admin@test.com', ?, 'admin')", [bcrypt.hashSync('Admin1234', 4)]);
  tokens.admin = (await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin1234' })).body.token;
  tokens.owner = await register('Owner One', 'owner@test.com', 'owner');
  tokens.buyer = await register('Buyer One', 'buyer@test.com', 'buyer');
  tokens.tenant = await register('Tenant One', 'tenant@test.com', 'tenant');
});

afterAll(() => fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true }));

describe('Increment 1: authentication', () => {
  test('rejects invalid registration with field errors', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'bad', password: '123', role: 'admin' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(['name', 'email', 'password', 'role']));
  });

  test('rejects a duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Again', email: 'owner@test.com', password: 'Test1234', role: 'buyer' });
    expect(res.status).toBe(409);
  });

  test('logs in and returns the current user', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${tokens.buyer}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'buyer@test.com', role: 'buyer' });
    expect(res.body.user.password_hash).toBeUndefined();
  });

  test('blocks login after repeated failures (audit fix NC-04)', async () => {
    resetAll();
    for (let i = 0; i < MAX_FAILURES; i += 1) {
      const r = await request(app).post('/api/auth/login').send({ email: 'buyer@test.com', password: 'wrong-pass1' });
      expect(r.status).toBe(401);
    }
    const blocked = await request(app).post('/api/auth/login').send({ email: 'buyer@test.com', password: 'Test1234' });
    expect(blocked.status).toBe(429);
    resetAll();
    const ok = await request(app).post('/api/auth/login').send({ email: 'buyer@test.com', password: 'Test1234' });
    expect(ok.status).toBe(200);
  });

  test('updates the profile and validates the phone number', async () => {
    const bad = await request(app).put('/api/auth/me').set('Authorization', `Bearer ${tokens.buyer}`).send({ name: 'Buyer One', phone: '123' });
    expect(bad.status).toBe(400);
    const ok = await request(app).put('/api/auth/me').set('Authorization', `Bearer ${tokens.buyer}`).send({ name: 'Buyer Updated', phone: '9123456789', city: 'Surat' });
    expect(ok.body.user).toMatchObject({ name: 'Buyer Updated', city: 'Surat' });
  });
});

describe('Increment 1: listing management', () => {
  test('a buyer cannot post a listing', async () => {
    const res = await createListing(tokens.buyer);
    expect(res.status).toBe(403);
  });

  test('validates listing fields', async () => {
    const res = await createListing(tokens.owner, listing({ title: 'Short', price: 10 }), false);
    expect(res.status).toBe(400);
    expect(res.body.fields).toHaveProperty('title');
    expect(res.body.fields).toHaveProperty('price');
  });

  test('new listing is pending, hidden from search, and live after approval', async () => {
    const created = await createListing(tokens.owner);
    expect(created.status).toBe(201);
    const { id, status, coverImage } = created.body.property;
    expect(status).toBe('pending');
    expect(coverImage).toMatch(/^\/uploads\/.+\.png$/);

    let search = await request(app).get('/api/properties');
    expect(search.body.items.find((p) => p.id === id)).toBeUndefined();

    const res = await approve(id);
    expect(res.body.property.status).toBe('approved');
    search = await request(app).get('/api/properties');
    expect(search.body.items.find((p) => p.id === id)).toBeDefined();
  });

  test('only the owner can edit; editing keeps a live listing live', async () => {
    const { id } = (await request(app).get('/api/properties')).body.items[0];
    const other = await request(app).put(`/api/properties/${id}`).set('Authorization', `Bearer ${tokens.buyer}`).send({ price: 1 });
    expect(other.status).toBe(403);
    const mine = await request(app).put(`/api/properties/${id}`).set('Authorization', `Bearer ${tokens.owner}`).send({ price: 7200000 });
    expect(mine.status).toBe(200);
    expect(mine.body.property).toMatchObject({ price: 7200000, status: 'approved' });
  });

  test('flags a near-identical listing as a possible duplicate', async () => {
    const res = await createListing(tokens.owner, listing({ title: 'Three BHK flat close to the river', price: 7300000, area_sqft: 1480 }), false);
    expect(res.status).toBe(201);
    expect(res.body.property.isDuplicateSuspect).toBe(true);
    const queue = await request(app).get('/api/admin/properties?status=duplicate').set('Authorization', `Bearer ${tokens.admin}`);
    expect(queue.body.items.map((p) => p.id)).toContain(res.body.property.id);
  });
});

describe('Increment 2: search and filters', () => {
  beforeAll(async () => {
    const data = [
      listing({ title: '2 BHK flat for rent in Vesu', listing_type: 'rent', price: 22000, city: 'Surat', locality: 'Vesu', bedrooms: 2, area_sqft: 1100 }),
      listing({ title: '1 BHK flat for rent in Adajan', listing_type: 'rent', price: 12000, city: 'Surat', locality: 'Adajan', bedrooms: 1, area_sqft: 600 }),
      listing({ title: 'Large villa with garden in Pal', property_type: 'villa', price: 21000000, city: 'Surat', locality: 'Pal', bedrooms: 5, area_sqft: 3500 }),
    ];
    for (const d of data) {
      const r = await createListing(tokens.owner, d, false);
      await approve(r.body.property.id);
    }
  });

  test('filters by city, listing type and budget', async () => {
    const res = await request(app).get('/api/properties').query({ city: 'surat', listingType: 'rent', maxPrice: 15000 });
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].locality).toBe('Adajan');
  });

  test('treats bedrooms=4 as 4 or more', async () => {
    const res = await request(app).get('/api/properties').query({ bedrooms: 4 });
    expect(res.body.items.every((p) => p.bedrooms >= 4)).toBe(true);
    expect(res.body.total).toBe(1);
  });

  test('sorts by price and paginates', async () => {
    const res = await request(app).get('/api/properties').query({ sort: 'price_asc', limit: 2, page: 1 });
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].price).toBeLessThanOrEqual(res.body.items[1].price);
    expect(res.body.pages).toBe(Math.ceil(res.body.total / 2));
  });

  test('keyword search matches the locality', async () => {
    const res = await request(app).get('/api/properties').query({ q: 'vesu' });
    expect(res.body.total).toBe(1);
  });

  test('details page hides contact info from guests and counts views', async () => {
    const { id } = (await request(app).get('/api/properties').query({ q: 'villa' })).body.items[0];
    const guest = await request(app).get(`/api/properties/${id}`);
    expect(guest.body.property.owner.phone).toBeNull();
    const user = await request(app).get(`/api/properties/${id}`).set('Authorization', `Bearer ${tokens.buyer}`);
    expect(user.body.property.owner.phone).toBe('9876500000');
    expect(user.body.property.views).toBe(2);
  });
});

describe('Increment 3: favourites, enquiries, dashboards', () => {
  let propertyId;
  let enquiryId;
  beforeAll(async () => {
    propertyId = (await request(app).get('/api/properties').query({ q: 'Vesu' })).body.items[0].id;
  });

  test('saves and removes a favourite', async () => {
    const auth = { Authorization: `Bearer ${tokens.tenant}` };
    await request(app).post(`/api/favourites/${propertyId}`).set(auth).expect(201);
    let list = await request(app).get('/api/favourites').set(auth);
    expect(list.body.items.map((p) => p.id)).toEqual([propertyId]);
    await request(app).delete(`/api/favourites/${propertyId}`).set(auth).expect(200);
    list = await request(app).get('/api/favourites').set(auth);
    expect(list.body.items).toHaveLength(0);
  });

  test('tenant sends an enquiry and the owner is notified', async () => {
    const res = await request(app).post('/api/enquiries').set('Authorization', `Bearer ${tokens.tenant}`)
      .send({ propertyId, message: 'Is this flat still available for November?' });
    expect(res.status).toBe(201);
    enquiryId = res.body.enquiryId;
    const notes = await request(app).get('/api/notifications').set('Authorization', `Bearer ${tokens.owner}`);
    expect(notes.body.items.some((n) => n.type === 'enquiry_new' && n.link === `/enquiries/${enquiryId}`)).toBe(true);
  });

  test('owner cannot enquire about their own listing', async () => {
    const res = await request(app).post('/api/enquiries').set('Authorization', `Bearer ${tokens.owner}`).send({ propertyId, message: 'Testing my own listing' });
    expect(res.status).toBe(400);
  });

  test('owner replies, status becomes replied, tenant is notified', async () => {
    await request(app).post(`/api/enquiries/${enquiryId}/messages`).set('Authorization', `Bearer ${tokens.owner}`)
      .send({ message: 'Yes, it is available. Visit any day after 5 PM.' }).expect(201);
    const thread = await request(app).get(`/api/enquiries/${enquiryId}`).set('Authorization', `Bearer ${tokens.tenant}`);
    expect(thread.body.enquiry.status).toBe('replied');
    expect(thread.body.messages).toHaveLength(2);
    const notes = await request(app).get('/api/notifications').set('Authorization', `Bearer ${tokens.tenant}`);
    expect(notes.body.unread).toBeGreaterThan(0);
  });

  test('an outsider cannot read the conversation', async () => {
    const res = await request(app).get(`/api/enquiries/${enquiryId}`).set('Authorization', `Bearer ${tokens.buyer}`);
    expect(res.status).toBe(403);
  });

  test('dashboards return role-specific stats', async () => {
    const owner = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${tokens.owner}`);
    expect(owner.body.kind).toBe('provider');
    expect(owner.body.stats.enquiries).toBe(1);
    const tenant = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${tokens.tenant}`);
    expect(tenant.body).toMatchObject({ kind: 'seeker', stats: { enquiries: 1, replied: 1 } });
  });
});

describe('Increment 4: moderation, reports, notifications', () => {
  test('rejecting needs a reason and notifies the owner', async () => {
    const created = await createListing(tokens.owner, listing({ title: 'Office space in the city centre', property_type: 'office', bedrooms: 0, locality: 'CG Road' }), false);
    const id = created.body.property.id;
    const noReason = await request(app).patch(`/api/admin/properties/${id}`).set('Authorization', `Bearer ${tokens.admin}`).send({ action: 'reject' });
    expect(noReason.status).toBe(400);
    const res = await request(app).patch(`/api/admin/properties/${id}`).set('Authorization', `Bearer ${tokens.admin}`).send({ action: 'reject', reason: 'Add a photo.' });
    expect(res.body.property).toMatchObject({ status: 'rejected', rejectionReason: 'Add a photo.' });

    // Editing a rejected listing sends it back for review
    const edit = await request(app).put(`/api/properties/${id}`).set('Authorization', `Bearer ${tokens.owner}`).send({ description: 'Now with details.' });
    expect(edit.body.property.status).toBe('pending');
  });

  test('a reported listing can be taken down by the admin', async () => {
    const { id } = (await request(app).get('/api/properties').query({ q: 'Adajan' })).body.items[0];
    const flag = await request(app).post(`/api/properties/${id}/flag`).set('Authorization', `Bearer ${tokens.buyer}`).send({ reason: 'fake', details: 'Asked for advance.' });
    expect(flag.status).toBe(201);
    const again = await request(app).post(`/api/properties/${id}/flag`).set('Authorization', `Bearer ${tokens.buyer}`).send({ reason: 'fake' });
    expect(again.status).toBe(409);

    const flags = await request(app).get('/api/admin/flags').set('Authorization', `Bearer ${tokens.admin}`);
    const report = flags.body.items.find((f) => f.property.id === id);
    await request(app).patch(`/api/admin/flags/${report.id}`).set('Authorization', `Bearer ${tokens.admin}`).send({ action: 'resolve' }).expect(200);
    const search = await request(app).get('/api/properties').query({ q: 'Adajan' });
    expect(search.body.total).toBe(0);
  });

  test('admin endpoints are closed to other roles', async () => {
    await request(app).get('/api/admin/reports').set('Authorization', `Bearer ${tokens.owner}`).expect(403);
    await request(app).get('/api/admin/reports').expect(401);
  });

  test('reports summarise users, listings and enquiries', async () => {
    const res = await request(app).get('/api/admin/reports').set('Authorization', `Bearer ${tokens.admin}`);
    expect(res.status).toBe(200);
    expect(res.body.totals.users).toBe(3);
    expect(res.body.totals.enquiries).toBe(1);
    expect(res.body.totals.responseRate).toBe(100);
    expect(res.body.newListings).toHaveLength(7);
  });

  test('marking notifications as read clears the unread count', async () => {
    const auth = { Authorization: `Bearer ${tokens.owner}` };
    await request(app).post('/api/notifications/read-all').set(auth).expect(200);
    const res = await request(app).get('/api/notifications').set(auth);
    expect(res.body.unread).toBe(0);
  });

  test('a suspended user cannot log in', async () => {
    const users = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${tokens.admin}`);
    const tenant = users.body.items.find((u) => u.email === 'tenant@test.com');
    await request(app).patch(`/api/admin/users/${tenant.id}`).set('Authorization', `Bearer ${tokens.admin}`).send({ isActive: false }).expect(200);
    const res = await request(app).post('/api/auth/login').send({ email: 'tenant@test.com', password: 'Test1234' });
    expect(res.status).toBe(403);
  });
});
