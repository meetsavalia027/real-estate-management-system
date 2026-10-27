# Using GitHub as the project management tool

Your tutorial documents (T3, T4, T10, T11) name GitHub as the project management tool: a repository for version control, GitHub Issues for tasks and defects, and a GitHub Projects board to track status. This guide sets that up for this project in about 45 minutes. Both members should do part of the work, so that both names appear on the board.

GitHub records the real date of every issue and commit. If the faculty asks when the board was set up, say so honestly: for example, that you set it up to track the build and testing of the final system.

## 1. Create the repository and push the code

1. On github.com, click **New repository**. Name it `real-estate-management-system`, make it **Private**, and do not add a README (the project already has one).
2. Under **Settings → Collaborators**, add your partner (and the faculty, if they ask for access).
3. In a terminal in the project folder, run (replace `YOUR-USERNAME`):

```
git init
git add .
git commit -m "Real Estate Management System: increments 1-4"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/real-estate-management-system.git
git push -u origin main
```

The `.gitignore` file keeps `node_modules`, the database file and uploaded photos out of the repository.

## 2. Milestones = increments

Under **Issues → Milestones → New milestone**, create one per increment, with the due dates from your T5 schedule:

- Increment 1: Core Foundation
- Increment 2: Search and Discovery
- Increment 3: Interaction and Engagement
- Increment 4: Administration and Alerts
- System Testing and Deployment

## 3. Labels

Under **Issues → Labels**, create:

- `increment-1`, `increment-2`, `increment-3`, `increment-4`
- `bug`, plus severity labels from T10: `severity: critical`, `severity: major`, `severity: minor`, `severity: cosmetic`
- `documentation`, `testing`

## 4. Issues from the WBS (T4)

Create one issue per work package, assign it to one member, and attach the milestone and label. Suggested list:

| Milestone | Issues |
| --- | --- |
| Increment 1 | Authentication and roles (register, login, JWT); Profile and password change; Listing create/edit/delete; Photo upload; Login rate limiting (CAPA CA-04) |
| Increment 2 | Search API with filters; Sorting and pagination; Search page UI with filter panel; Property details page and gallery; Similar listings |
| Increment 3 | Enquiry conversations API; Enquiry inbox and thread UI; Favourites / shortlist; Buyer dashboard; Owner dashboard |
| Increment 4 | Notifications and bell; Admin moderation queue; Duplicate listing detection; Report a listing and admin handling; Admin reports page; User suspension |
| Testing and Deployment | Automated API tests (Jest + Supertest); Demo data seed script; README and user documentation; Demo video |

Close each issue once its feature is in the code, with a comment linking the commit or the file.

## 5. Defects

While you rehearse the demo, log any real bug you find as an issue with the `bug` label and a severity, following the defect life cycle in T10 (New → Assigned → Fixed → Retested → Closed). Two or three genuine defects logged and closed are better evidence than a perfect, empty bug list.

## 6. The project board

1. On your GitHub profile, open **Projects → New project → Board**. Name it "REMS".
2. Use these columns: **Backlog, In progress, In review, Done**.
3. Add all the issues (**Add item → #** and pick them).
4. Optional: add a **Roadmap** view grouped by milestone. This shows the increments on a timeline, which you can compare with the Gantt chart in T5.

## 7. Release

Under **Releases → Draft a new release**, create the tag `v1.0`, title it "Final submission", and list the four increments in the notes.

## Optional: create milestones and issues from the command line

If you install the GitHub CLI (cli.github.com) and run `gh auth login`, these commands create items without clicking through the website:

```
gh api repos/:owner/:repo/milestones -f title="Increment 1: Core Foundation"
gh label create increment-1 --color 1F4E79
gh issue create --title "Authentication and roles" --label increment-1 --milestone "Increment 1: Core Foundation" --assignee @me
```
