# Demonstration video plan

Target length is 12 to 15 minutes. Both members stay visible on webcam for the whole video and take turns speaking. "Member A" and "Member B" below are placeholders; swap them however you like, but keep the speaking time roughly equal.

Name the final file: `RollNo1_RollNo2_Real_Estate_Management_System.mp4`

## Before you press record

1. Run `npm run seed` to reset the demo data, then `npm run dev`.
2. Open three browser windows side by side, so you never have to log out during the video:
   - **Window 1 (normal Chrome):** start logged out; you will log in as the owner (`owner@demo.com`) during the video
   - **Window 2 (Chrome incognito):** the buyer, `buyer@demo.com`
   - **Window 3 (Edge, or another browser):** the admin, `admin@demo.com`
3. Keep 3 or 4 real photos of a flat or house in a folder on the desktop (photos from your phone are fine). You will upload them live.
4. Set browser zoom to 110–125%, hide the bookmarks bar, turn on Do Not Disturb, and close other tabs.
5. Open a terminal in the project folder for the testing part.
6. Have the T1–T12 documents and your GitHub project board open in tabs.

## Running order

### 1. Introduction (0:00–1:00), both members

Say your names and roll numbers, then the project title. One sentence on the problem: property information is scattered, often outdated, and fake listings are common. One sentence on the solution: a single platform where every listing is checked before it goes live.

Then the technology: React front end, Node.js and Express back end, SQL database, built with the Incremental Model in four increments.

### 2. Project management work (1:00–4:00), Member A

Show each tutorial document for a few seconds and say one line about it:

- **T2:** We compared five process models and chose Incremental, because the modules depend on each other in a natural order.
- **T3:** Four increments: core foundation, search, interaction, administration.
- **T4 and T5:** The WBS, and the Gantt chart with the critical path.
- **T7 and T8:** The estimates: about 205 function points, and COCOMO organic mode gives about 15.4 person-months.
- **T9:** The top risks and how we planned to handle them.
- **T10–T12:** The quality plan: 70% test coverage target, code review, defect tracking.

Then switch to the GitHub project board. Show the issues grouped by increment, the milestones, and the defect issues with severity labels (see `docs/GITHUB_SETUP.md`).

### 3. Increment 1: accounts and listings (4:00–6:30), Member B

1. In Window 1, show the **Sign up** page. Type a weak password such as `abc` and click Create account, so the validation messages appear. Then go back and log in as the owner.
2. Click **Post property**. Fill in a real-looking listing, for example a 2 BHK in a locality you know with price and area, and upload your photos.
3. Click **Submit for review**. Point out the message: the listing goes live only after an admin approves it.
4. On the **Dashboard**, show the new listing with the *Pending review* badge.

**Say:** "This is Increment 1 from our SPMP: authentication with roles, and listing management with photo upload."

### 4. Moderation step (6:30–7:30), Member A, Window 3 (admin)

1. Show the notification bell, then click the new-listing notification. It opens the **Listing moderation** tab.
2. Click **Approve** on your new listing.
3. Open the **Possible duplicates** filter. Listing #21 was caught automatically because it matches #7 (same locality, similar price and area). Click **Reject** and keep the suggested reason.

**Say:** "Moderation belongs to Increment 4, but it is part of the listing flow, so we show it here. It handles the fake and duplicate listing constraint from T1."

### 5. Increment 2: search and details (7:30–9:00), Member B, Window 2 (buyer)

1. Click **Buy**, choose your city, set a maximum budget, pick 2 BHK, and sort by price.
2. Your newly approved listing appears in the results. Open it.
3. Show the photo gallery, the facts table, the price per square foot, and the owner's contact details (visible because you are logged in).

**Say:** "Increment 2: search, filters, sorting, pagination and the details page."

### 6. Increment 3: shortlist, enquiry, dashboards (9:00–11:00), Member A

1. In Window 2 (buyer), click **Save to shortlist**. Then send an enquiry using the pre-filled message.
2. In Window 1 (owner), the bell count goes up within about 15 seconds. Open the notification and reply in the conversation.
3. In Window 2 (buyer), the reply notification appears. Open it to show the conversation with status *Replied*.
4. Show both dashboards: the buyer's shortlist and enquiries, and the owner's listings table with views, enquiries and saves.

### 7. Increment 4: reports and administration (11:00–12:30), Member B

1. In Window 2 (buyer), open any other listing, click **Report this listing**, choose *Fake or fraudulent* and send.
2. In Window 3 (admin), open **Reported listings**, read the report, and click **Take listing down**. Mention that the owner is notified with the reason.
3. Open **Overview** and walk through the reports: listings by city and type, enquiries answered, 7-day activity, and most viewed listings.
4. Open **Users** and show that a user can be suspended.

### 8. Quality and testing (12:30–13:30), Member A

1. In the terminal, run `npm test`. Show **27 tests passed** and the coverage of about 79% against the T10 target of 70%.
2. Show the security fix live: open a new incognito tab at http://localhost:5173/login and try `sana@demo.com` with a wrong password 6 times. The message *Too many failed login attempts* appears. (Use this spare account so the accounts you need stay unlocked; the block lasts 15 minutes.)

**Say:** "This fixes audit finding NC-04 from T11, corrective action CA-04."

### 9. Closing (13:30–14:30), both members

Summarise: all four planned increments were delivered and tested. Mention what you would add next as future enhancements recorded as change requests (as T1 and T3 describe): email and SMS alerts, a map view, verified-owner badges, and deployment to a cloud server. Thank the faculty.

## If something goes wrong while recording

Stop, run `npm run seed` to reset the data, and record that section again. Record the video section by section and join the parts afterwards; you do not need one perfect take.

## Questions the faculty may ask

**Why SQLite and not MySQL?**
SQLite runs inside the Node.js process, so the project needs no separate database server and runs on any laptop. The tables are standard SQL; the same design for MySQL is in `docs/schema.sql`, and only `server/src/db.js` would change.

**How are passwords stored?**
Passwords are never stored as plain text. They are hashed with bcrypt (`server/src/routes/auth.js`), and login compares the hash.

**How does the server know who is logged in?**
After login, the server returns a signed JWT token. The browser sends it with every request in the Authorization header, and `server/src/middleware/auth.js` checks the token and the user's role.

**How do you stop a buyer from posting a listing or opening the admin panel?**
The `requireRole(...)` middleware runs on each route. Checking only in the user interface is not enough, so the server enforces it too, and the tests check that a buyer gets a 403 error.

**How does duplicate detection work?**
When a listing is posted, the server looks for a live or pending listing in the same city and locality, with the same type and bedrooms, an area within 5% and a price within 10% (`findDuplicate` in `server/src/routes/properties.js`).

**What happens when an owner edits a rejected listing?**
It goes back to *pending*, and the admin is notified to review it again.

**Why the Incremental Model?**
The module list was stable from T1, and the modules build on each other: listings need accounts, search needs listings, enquiries need both. Each increment gave a working, reviewable system.

**What is tested?**
27 API tests across all four increments: validation, permissions, the listing life cycle, filters, enquiries, notifications, moderation, reports and the rate limit (`server/tests/api.test.js`).

**The plan in T3 assumes a team of 5–6 people, but you are two. Why?**
The SPMP models the project as a real-world team would run it. As a two-person group, we built the core of every increment, and features beyond that (email alerts, a map view) are recorded as future enhancements.
