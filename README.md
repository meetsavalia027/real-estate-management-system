# Real Estate Management System (REMS)

A web platform where buyers and tenants search, shortlist and enquire about properties, and owners, agents and builders list properties for sale or rent. Every new listing is checked by an administrator before it goes live, which addresses the fake and duplicate listing problem described in T1.

Built for the Software Project Management (SPM) Innovative Assignment, following the Incremental Model chosen in T2 and planned in the SPMP (T3).

| Layer | Technology |
| --- | --- |
| Front end | React 18, React Router, Vite |
| Back end | Node.js, Express |
| Database | SQLite through sql.js (no database server needed). The equivalent MySQL schema is in `docs/schema.sql` |
| Authentication | JWT tokens, bcrypt password hashing, login rate limiting |
| Testing | Jest and Supertest (27 automated API tests) |

## How to run

You need **Node.js 20 or newer** (check with `node -v`; download from nodejs.org if needed).

Open a terminal in this folder and run:

```
npm install        # installs everything (first time only, takes 1-2 minutes)
npm run seed       # creates the database and loads demo data
npm run dev        # starts the API (port 5000) and the website (port 5173)
```

Then open **http://localhost:5173** in your browser. Press `Ctrl + C` in the terminal to stop.

Run `npm run seed` again at any time to reset the demo data (for example, right before recording the demonstration video).

### Demo accounts

All demo accounts use the password **`Demo@123`**. The login page also lists them, and clicking one fills the form.

| Role | Email | Name |
| --- | --- | --- |
| Buyer | buyer@demo.com | Amit Verma |
| Tenant | tenant@demo.com | Priya Nair |
| Owner / Landlord | owner@demo.com | Rajesh Patel |
| Agent | agent@demo.com | Neha Sharma |
| Builder | builder@demo.com | Skyline Developers |
| Administrator | admin@demo.com | Admin |
| Owner (Mumbai listings) | kunal@demo.com | Kunal Mehta |
| Buyer | sana@demo.com | Sana Shaikh |

The demo data contains 23 listings in 6 cities, 5 enquiry conversations, 2 listings waiting for approval (one is flagged as a possible duplicate), 1 rejected listing and 1 listing reported as fake.

### Other commands

| Command | What it does |
| --- | --- |
| `npm test` | Runs the automated tests and prints a coverage report |
| `npm run build` then `npm start` | Builds the website and serves everything from one server at http://localhost:5000 |

## Modules and increments

Each module maps to an increment of the SPMP (T3) and a branch of the WBS (T4). Each source file names its increment at the top.

| Increment (T3) | Module | Main files |
| --- | --- | --- |
| 1. Core Foundation | Registration, login, role-based access, profile and password | `server/src/routes/auth.js`, `server/src/middleware/auth.js`, `client/src/pages/Login.jsx`, `Register.jsx`, `Profile.jsx` |
| 1. Core Foundation | Property listing management: add, edit, delete, photo upload, mark sold or rented | `server/src/routes/properties.js`, `server/src/middleware/upload.js`, `client/src/pages/PropertyForm.jsx` |
| 2. Search and Discovery | Search, filters (city, locality, budget, bedrooms, area, type, furnishing), sorting, pagination | `server/src/routes/properties.js` (GET /), `client/src/pages/Search.jsx` |
| 2. Search and Discovery | Property details page with photo gallery and similar listings | `client/src/pages/PropertyDetail.jsx` |
| 3. Interaction and Engagement | Enquiry and communication (conversation threads) | `server/src/routes/enquiries.js`, `client/src/pages/Enquiries.jsx`, `EnquiryThread.jsx` |
| 3. Interaction and Engagement | Favourites / shortlist | `server/src/routes/favourites.js`, `client/src/components/PropertyCard.jsx` |
| 3. Interaction and Engagement | Role-specific dashboards (buyer/tenant and owner/agent/builder) | `server/src/routes/dashboard.js`, `client/src/pages/Dashboard.jsx` |
| 4. Administration and Alerts | Notifications and enquiry-status alerts | `server/src/routes/notifications.js`, `client/src/components/NotificationBell.jsx` |
| 4. Administration and Alerts | Admin moderation (approve or reject), duplicate detection, reported listings, user suspension | `server/src/routes/admin.js`, `server/src/routes/properties.js`, `client/src/pages/Admin.jsx` |
| 4. Administration and Alerts | Reports: listings by city, type and status, users by role, 7-day activity, most viewed | `server/src/routes/admin.js` (GET /reports), `client/src/pages/Admin.jsx` |

### Links to other tutorial tasks

- **T1 constraints.** Fake or duplicate listings are handled by admin moderation, automatic duplicate detection and user reports. Privacy is protected by showing contact details only to logged-in users, hashing passwords and using role checks on every API route.
- **T10 / T12 quality targets.** The automated tests cover all four increments. Backend statement coverage is about 79% against the target of 70% or more. Run `npm test` to see the report.
- **T11 audit finding NC-04 (no login rate limiting).** This is fixed (CAPA CA-04): after 5 failed logins for the same email, further attempts are blocked for 15 minutes. See `server/src/middleware/rateLimit.js` and its test.

## How the main features work

- **Listing life cycle.** A new listing starts as *pending*. An admin approves it (it becomes *live*) or rejects it with a reason. The owner can edit a rejected listing to send it for review again, and can mark a live listing as *sold* or *rented*.
- **Duplicate detection.** When a listing is posted, the server looks for a live or pending listing with the same city, locality, type, listing type and bedrooms, an area within 5% and a price within 10%. If it finds one, the new listing is marked as a possible duplicate in the admin queue.
- **Enquiries.** A buyer or tenant sends an enquiry from the listing page. The owner gets a notification and replies in a conversation thread. The status moves from *awaiting reply* to *replied*, and the buyer is notified.
- **Reports by users.** Any logged-in user can report a listing as fake, duplicate or wrong. The admin can take the listing down or dismiss the report.

## Folder structure

```
real-estate-management-system/
├── client/                 React front end
│   └── src/
│       ├── pages/          One file per screen
│       ├── components/     Navbar, property card, notification bell, etc.
│       ├── context/        Login state and toast messages
│       ├── api/client.js   Calls to the back end
│       └── styles.css
├── server/                 Node.js + Express back end
│   ├── src/
│   │   ├── routes/         API endpoints, one file per module
│   │   ├── middleware/     Login check, roles, rate limit, photo upload
│   │   ├── db.js           Database tables and query helpers
│   │   └── seed.js         Demo data
│   ├── tests/api.test.js   Automated tests
│   ├── data/               Database file (created by npm run seed)
│   └── uploads/            Uploaded photos
├── docs/
│   ├── DEMO_SCRIPT.md      Plan for the demonstration video
│   ├── GITHUB_SETUP.md     Setting up GitHub as the project management tool
│   └── schema.sql          MySQL version of the database
└── scripts/dev.js          Starts the API and website together
```

## API summary

| Method and path | Purpose | Who |
| --- | --- | --- |
| POST /api/auth/register, POST /api/auth/login | Create account, log in | Anyone |
| GET, PUT /api/auth/me; PUT /api/auth/me/password | View or edit profile, change password | Logged in |
| GET /api/properties | Search with filters, sorting and pagination | Anyone |
| GET /api/properties/:id | Listing details | Anyone (contact details only when logged in) |
| POST /api/properties; PUT, DELETE /api/properties/:id | Create, edit, delete a listing | Owner, agent, builder |
| PATCH /api/properties/:id/status | Mark sold or rented, or relist | Listing owner |
| POST, DELETE /api/properties/:id/images | Add or remove photos | Listing owner |
| POST /api/properties/:id/flag | Report a listing | Logged in |
| GET, POST, DELETE /api/favourites | Shortlist | Logged in |
| GET, POST /api/enquiries; GET /api/enquiries/:id; POST /api/enquiries/:id/messages | Enquiries and replies | Logged in |
| GET /api/notifications | Notifications and unread count | Logged in |
| GET /api/dashboard | Dashboard numbers for the user's role | Logged in |
| /api/admin/... | Moderation, reports, flags, users | Admin only |

## Troubleshooting

- **`npm` is not recognised.** Node.js is not installed, or the terminal was opened before installing it. Install Node.js and open a new terminal.
- **"Port 5000 is already in use".** Another program is using the port. Close it, or run the API on another port with `set PORT=5050` (Windows) or `PORT=5050` (Mac/Linux), and change the port in `client/vite.config.js` to match.
- **The page says it cannot reach the server.** The API is not running. Make sure you started with `npm run dev`, not by opening the HTML file directly.
- **Photos do not upload.** Use JPG, PNG or WebP images of 5 MB or less, with at most 8 photos per listing.
