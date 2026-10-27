/**
 * Resets the database and loads demo data for the project demonstration.
 * Run with:  npm run seed
 * All demo accounts use the password  Demo@123
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { UPLOAD_DIR } = require('./middleware/upload');
const { propertySvg } = require('./seedImages');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'realestate.db');
const SEED_DIR = path.join(UPLOAD_DIR, 'seed');
const PASSWORD = 'Demo@123';

/** SQLite datetime string for "n days ago" (optionally minus some hours). */
function ago(days, hours = 0) {
  const d = new Date(Date.now() - days * 86400000 - hours * 3600000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const USERS = [
  { key: 'admin', name: 'Admin', email: 'admin@demo.com', phone: '9000000001', role: 'admin', city: 'Ahmedabad' },
  { key: 'rajesh', name: 'Rajesh Patel', email: 'owner@demo.com', phone: '9876543210', role: 'owner', city: 'Ahmedabad' },
  { key: 'neha', name: 'Neha Sharma', email: 'agent@demo.com', phone: '9823456781', role: 'agent', city: 'Surat' },
  { key: 'skyline', name: 'Skyline Developers', email: 'builder@demo.com', phone: '9812345670', role: 'builder', city: 'Vadodara' },
  { key: 'amit', name: 'Amit Verma', email: 'buyer@demo.com', phone: '9898012345', role: 'buyer', city: 'Ahmedabad' },
  { key: 'priya', name: 'Priya Nair', email: 'tenant@demo.com', phone: '9765432109', role: 'tenant', city: 'Pune' },
  { key: 'kunal', name: 'Kunal Mehta', email: 'kunal@demo.com', phone: '9819988776', role: 'owner', city: 'Mumbai' },
  { key: 'sana', name: 'Sana Shaikh', email: 'sana@demo.com', phone: '9725511223', role: 'buyer', city: 'Surat' },
];

// [key, owner, title, listing, type, price, city, locality, beds, baths, area, furnishing, status, daysAgo, views, description]
const PROPERTIES = [
  ['p1', 'rajesh', '3 BHK apartment in Satellite with covered parking', 'sale', 'apartment', 9500000, 'Ahmedabad', 'Satellite', 3, 3, 1650, 'semi-furnished', 'approved', 20, 142,
    'East-facing 3 BHK on the 6th floor of a 10-year-old society. Modular kitchen, wardrobes in all bedrooms, one covered car parking and lift with power backup. Walking distance to schools and the BRTS stop.'],
  ['p2', 'rajesh', '2 BHK flat for rent near Prahlad Nagar Garden', 'rent', 'apartment', 28000, 'Ahmedabad', 'Prahlad Nagar', 2, 2, 1180, 'furnished', 'approved', 12, 96,
    'Fully furnished 2 BHK with AC in both bedrooms, washing machine, fridge and sofa set. Families and working professionals preferred. Maintenance included in rent; two months deposit.'],
  ['p3', 'neha', '4 BHK bungalow in Bodakdev with private garden', 'sale', 'house', 32500000, 'Ahmedabad', 'Bodakdev', 4, 5, 3600, 'semi-furnished', 'approved', 30, 210,
    'Independent bungalow on a 4,000 sq ft plot with a landscaped front garden, two-car porch and servant room. Clear title, approved by major banks for home loans.'],
  ['p4', 'skyline', '2 BHK in Skyline Heights, Gota (new launch)', 'sale', 'apartment', 5400000, 'Ahmedabad', 'Gota', 2, 2, 1120, 'unfurnished', 'approved', 8, 75,
    'New launch by Skyline Developers. RERA registered project with clubhouse, children play area and 24x7 security. Possession in 18 months. Flexible payment plan available.'],
  ['p5', 'neha', 'Furnished office on SG Highway, 1,200 sq ft', 'rent', 'office', 85000, 'Ahmedabad', 'SG Highway', 0, 2, 1200, 'furnished', 'approved', 15, 58,
    'Ready-to-move office with 18 workstations, 2 cabins, a conference room and pantry. Building has visitor parking and 100% power backup.'],
  ['p6', 'rajesh', 'Residential plot in Shela, 2,700 sq ft', 'sale', 'plot', 6750000, 'Ahmedabad', 'Shela', 0, 0, 2700, 'unfurnished', 'approved', 25, 64,
    'NA plot in a gated plotting scheme with internal roads, street lights and water connection. Ideal for building a bungalow.'],
  ['p7', 'neha', '3 BHK in Vesu with clubhouse and gym', 'sale', 'apartment', 8200000, 'Surat', 'Vesu', 3, 3, 1750, 'semi-furnished', 'approved', 10, 120,
    'Spacious 3 BHK in a premium tower in Vesu. Society has swimming pool, gym, clubhouse and two-level parking. Close to VR Mall and schools.'],
  ['p8', 'neha', '1 BHK for rent in Adajan, close to riverfront', 'rent', 'apartment', 12500, 'Surat', 'Adajan', 1, 1, 650, 'semi-furnished', 'approved', 5, 44,
    'Compact 1 BHK suitable for a small family or bachelors. Wardrobe and kitchen platform, 24x7 water supply.'],
  ['p9', 'skyline', 'Ground-floor shop near Ring Road textile market', 'rent', 'shop', 45000, 'Surat', 'Ring Road', 0, 1, 400, 'unfurnished', 'approved', 18, 37,
    'Main-road facing shop with high footfall, shutter frontage of 14 ft and attached washroom. Suitable for retail or showroom.'],
  ['p10', 'neha', 'Duplex villa in Pal with home theatre', 'sale', 'villa', 21000000, 'Surat', 'Pal', 4, 4, 3200, 'furnished', 'approved', 40, 188,
    'Luxurious duplex villa with Italian marble flooring, home theatre, private terrace garden and a two-car garage. Fully furnished with branded fittings.'],
  ['p11', 'skyline', '3 BHK villa in Skyline Greens, Gotri', 'sale', 'villa', 14500000, 'Vadodara', 'Gotri', 3, 3, 2400, 'semi-furnished', 'approved', 22, 90,
    'Row villa in a gated community of 60 villas with clubhouse, jogging track and temple. Ready possession, RERA registered.'],
  ['p12', 'kunal', '2 BHK for rent in Alkapuri', 'rent', 'apartment', 18000, 'Vadodara', 'Alkapuri', 2, 2, 1050, 'semi-furnished', 'approved', 9, 33,
    '2 BHK in a central location, close to the railway station and shopping. Covered parking for one car.'],
  ['p13', 'kunal', '2 BHK sea-facing flat in Andheri West', 'sale', 'apartment', 26500000, 'Mumbai', 'Andheri West', 2, 2, 950, 'furnished', 'approved', 14, 260,
    'Sea-facing 2 BHK on a high floor with a large living room and balcony. 5 minutes from the metro station. Society with gym and garden.'],
  ['p14', 'kunal', '1 BHK for rent in Powai, Hiranandani Gardens', 'rent', 'apartment', 42000, 'Mumbai', 'Powai', 1, 1, 600, 'furnished', 'approved', 6, 150,
    'Furnished 1 BHK with lake view, modular kitchen and AC. Close to offices, cafes and the lake promenade.'],
  ['p15', 'kunal', 'Office for rent in BKC, ready to move', 'rent', 'office', 350000, 'Mumbai', 'Bandra Kurla Complex', 0, 2, 2200, 'furnished', 'approved', 28, 80,
    'Grade-A office with 40 workstations, 4 cabins, 2 meeting rooms and dedicated parking slots. Available on a 3-year lease.'],
  ['p16', 'neha', '2 BHK in Hinjewadi Phase 1 near IT park', 'rent', 'apartment', 22000, 'Pune', 'Hinjewadi', 2, 2, 1000, 'semi-furnished', 'approved', 11, 70,
    '2 BHK in a gated society 5 minutes from the IT park. Gym, swimming pool and 24x7 security. Suitable for IT professionals.'],
  ['p17', 'skyline', '3 BHK apartment in Baner with balcony view', 'sale', 'apartment', 12800000, 'Pune', 'Baner', 3, 3, 1450, 'unfurnished', 'approved', 16, 85,
    'Brand new 3 BHK with hill-view balcony, two covered parkings and premium amenities. Close to Balewadi High Street.'],
  ['p18', 'rajesh', 'Independent house in Kothrud with terrace', 'sale', 'house', 18500000, 'Pune', 'Kothrud', 3, 2, 1900, 'semi-furnished', 'approved', 35, 66,
    'Two-storey independent house with an open terrace, parking for two cars and a small garden. Quiet residential lane.'],
  ['p19', 'kunal', '2 BHK in Whitefield gated community', 'rent', 'apartment', 35000, 'Bengaluru', 'Whitefield', 2, 2, 1200, 'semi-furnished', 'approved', 4, 52,
    '2 BHK in a large gated community with clubhouse, tennis court and kids area. Close to tech parks and the metro.'],
  ['p20', 'rajesh', '2 BHK flat in Navrangpura near Law Garden', 'sale', 'apartment', 7200000, 'Ahmedabad', 'Navrangpura', 2, 2, 1250, 'semi-furnished', 'pending', 1, 0,
    'Well-maintained 2 BHK in a prime location, walking distance to Law Garden and CG Road.'],
  ['p21', 'neha', 'Spacious 3 BHK flat in Vesu, clubhouse and gym', 'sale', 'apartment', 8000000, 'Surat', 'Vesu', 3, 3, 1720, 'semi-furnished', 'pending', 0, 0,
    'Large 3 BHK with clubhouse, gym and pool in the society. Near VR Mall.'],
  ['p22', 'skyline', 'Commercial plot on Sindhu Bhavan Road', 'sale', 'plot', 45000000, 'Ahmedabad', 'Sindhu Bhavan Road', 0, 0, 6000, 'unfurnished', 'rejected', 7, 0,
    'Corner commercial plot suitable for a showroom or office building.'],
  ['p23', 'kunal', '1 RK for rent in Andheri East', 'rent', 'apartment', 18000, 'Mumbai', 'Andheri East', 1, 1, 350, 'furnished', 'rented', 45, 140,
    'Compact furnished 1 RK near the metro station.'],
];

function main() {
  // Start from a clean database and clean seed images
  if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
  fs.rmSync(SEED_DIR, { recursive: true, force: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  return db.initDb(DB_FILE).then(() => {
    const hash = bcrypt.hashSync(PASSWORD, 10);
    const users = {};
    const props = {};

    db.transaction(() => {
      USERS.forEach((u, i) => {
        users[u.key] = db.run(
          'INSERT INTO users (name, email, phone, password_hash, role, city, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [u.name, u.email, u.phone, hash, u.role, u.city, ago(60 - i * 3)],
        ).lastId;
      });

      PROPERTIES.forEach((row, index) => {
        const [key, owner, title, listing, type, price, city, locality, beds, baths, area, furnishing, status, days, views, description] = row;
        const id = db.run(
          `INSERT INTO properties (owner_id, title, description, listing_type, property_type, price, city, locality,
                                   bedrooms, bathrooms, area_sqft, furnishing, status, views, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [users[owner], title, description, listing, type, price, city, locality, beds, baths, area, furnishing, status, views, ago(days, 3), ago(days, 1)],
        ).lastId;
        props[key] = id;

        const count = type === 'plot' ? 2 : 3;
        for (let v = 0; v < count; v += 1) {
          const file = `p${id}-${v + 1}.svg`;
          fs.writeFileSync(path.join(SEED_DIR, file), propertySvg(type, index + 1, v));
          db.run('INSERT INTO property_images (property_id, url, sort_order) VALUES (?, ?, ?)', [id, `/uploads/seed/${file}`, v]);
        }
      });

      // Moderation states
      db.run('UPDATE properties SET is_duplicate_suspect = 1, duplicate_of = ? WHERE id = ?', [props.p7, props.p21]);
      db.run('UPDATE properties SET rejection_reason = ? WHERE id = ?', [
        'Ownership documents not provided. Add the survey number in the address and resubmit.', props.p22]);

      // Favourites
      [['amit', 'p1'], ['amit', 'p3'], ['amit', 'p4'], ['priya', 'p2'], ['priya', 'p16'], ['sana', 'p13'], ['sana', 'p7']]
        .forEach(([u, p], i) => db.run('INSERT INTO favourites (user_id, property_id, created_at) VALUES (?, ?, ?)', [users[u], props[p], ago(6 - i * 0.5)]));

      // Enquiries with messages: [sender, property, status, daysAgo, messages[[who, text, hoursAfter]]]
      const ENQUIRIES = [
        ['amit', 'p1', 'replied', 3, [
          ['amit', 'Hello, is the price negotiable? I would like to visit this Saturday morning.', 0],
          ['rajesh', 'Hi Amit, there is some room for negotiation. Saturday 10 AM works, I will share the exact location.', 5],
        ]],
        ['priya', 'p2', 'open', 1, [
          ['priya', 'Is the flat available from 1st November? I work nearby and need it for at least 11 months.', 0],
        ]],
        ['amit', 'p3', 'replied', 6, [
          ['amit', 'Does the bungalow have a clear title, and is a home loan possible on it?', 0],
          ['neha', 'Yes, the title is clear and the property is approved by SBI and HDFC for home loans.', 20],
          ['amit', 'Great, please share the available slots for a site visit next week.', 30],
          ['neha', 'Tuesday or Thursday after 4 PM works. I will confirm the time a day before.', 34],
        ]],
        ['sana', 'p13', 'open', 2, [
          ['sana', 'Is there a parking slot included with this flat?', 0],
        ]],
        ['priya', 'p16', 'replied', 4, [
          ['priya', 'Are pets allowed in this society? I have a small dog.', 0],
          ['neha', 'Yes, the society allows pets. The owner only asks for a slightly higher deposit.', 6],
        ]],
      ];
      ENQUIRIES.forEach(([sender, pkey, status, days, msgs]) => {
        const prop = db.get('SELECT owner_id, title FROM properties WHERE id = ?', [props[pkey]]);
        const last = msgs[msgs.length - 1][2];
        const eid = db.run(
          'INSERT INTO enquiries (property_id, sender_id, receiver_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [props[pkey], users[sender], prop.owner_id, status, ago(days), ago(days, -last)],
        ).lastId;
        msgs.forEach(([who, text, hrs]) => {
          db.run('INSERT INTO enquiry_messages (enquiry_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)', [eid, users[who], text, ago(days, -hrs)]);
        });
        const senderName = USERS.find((u) => u.key === sender).name;
        db.run('INSERT INTO notifications (user_id, type, message, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [prop.owner_id, 'enquiry_new', `${senderName} sent an enquiry about "${prop.title}".`, `/enquiries/${eid}`, status === 'open' ? 0 : 1, ago(days)]);
        if (status === 'replied') {
          db.run('INSERT INTO notifications (user_id, type, message, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [users[sender], 'enquiry_reply', `The owner replied to your enquiry about "${prop.title}".`, `/enquiries/${eid}`, 0, ago(days, -last)]);
        }
      });

      // A reported listing waiting for the admin
      db.run('INSERT INTO flags (property_id, reporter_id, reason, details, created_at) VALUES (?, ?, ?, ?, ?)',
        [props.p8, users.sana, 'fake', 'The person asked for an advance payment before showing the flat.', ago(1)]);

      // Admin and owner notifications
      const n = (u, type, msg, link, read, days) => db.run(
        'INSERT INTO notifications (user_id, type, message, link, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [users[u], type, msg, link, read, ago(days)],
      );
      n('admin', 'listing_pending', 'New listing waiting for review: "2 BHK flat in Navrangpura near Law Garden".', '/admin?tab=moderation', 0, 1);
      n('admin', 'listing_duplicate', 'Possible duplicate submitted: "Spacious 3 BHK flat in Vesu, clubhouse and gym" looks like listing #' + props.p7 + '.', '/admin?tab=moderation', 0, 0);
      n('admin', 'listing_flagged', 'Listing "1 BHK for rent in Adajan, close to riverfront" was reported as fake.', '/admin?tab=flags', 0, 1);
      n('rajesh', 'listing_approved', 'Your listing "3 BHK apartment in Satellite with covered parking" is now live.', `/properties/${props.p1}`, 1, 19);
      n('skyline', 'listing_rejected', 'Your listing "Commercial plot on Sindhu Bhavan Road" was not approved: Ownership documents not provided.', '/dashboard', 0, 6);
    });

    console.log('\nDemo data loaded.');
    console.log(`  ${USERS.length} users, ${PROPERTIES.length} listings, 5 enquiries, 1 open report\n`);
    console.log('  Demo accounts (password for all: Demo@123)');
    USERS.forEach((u) => console.log(`    ${u.role.padEnd(8)} ${u.email.padEnd(18)} ${u.name}`));
    console.log('');
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main, PASSWORD };
