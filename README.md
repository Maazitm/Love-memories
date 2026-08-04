# Smriti — by Dwani Academy

A simple, beautiful website where your batch can send photos and videos
(full original quality, no compression) from any phone or laptop — no app
install, no login needed. Everything lands in a Google Drive folder that
only you (admin) can browse, through a password-protected admin page.

```
smriti/
├── public/          → the website (student upload page + admin page)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── admin.html
│   └── admin.js
└── server/           → the backend that talks to Google Drive
    ├── server.js
    ├── package.json
    └── .env.example
```

---

## 1. Set up Google Drive (one-time, ~10 minutes)

You'll create a **service account** — a robot Google account that uploads
files on your behalf. Students never see or touch this; it just works
silently in the background.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a new project (e.g. "Smriti").
2. In the search bar, open **"Google Drive API"** → click **Enable**.
3. Go to **APIs & Services → Credentials → Create Credentials → Service account**.
   - Name it anything (e.g. `smriti-uploader`).
   - Skip the optional permission/role steps — click through to **Done**.
4. Click into the service account you just created → **Keys** tab → **Add Key → Create new key → JSON**.
   - This downloads a `.json` file. Rename it to `service-account.json` and place it inside the `server/` folder.
   - **Keep this file private** — never commit it to a public repo (a `.gitignore` is already set up for this).
5. Open the JSON file and copy the `client_email` value (looks like `smriti-uploader@your-project.iam.gserviceaccount.com`).
6. In your **own** Google Drive (your normal Google account), create a folder — e.g. "Smriti Uploads".
   - Right-click it → **Share** → paste the `client_email` from step 5 → give it **Editor** access.
   - This is what lets the robot account drop files into a folder *you* own — so it appears in your Drive, under your storage.
7. Open that folder in the browser and copy the ID from the URL:
   `https://drive.google.com/drive/folders/`**`THIS_PART_IS_THE_FOLDER_ID`**

You now have everything for `server/.env`.

> **On storage:** every Google account gets 15GB free. If you want a full
> 20GB+ pool with room to grow, either use a Drive account that already has
> Google One storage, or upgrade that one Drive account (~₹130/month for
> 100GB on Google One) — cheaper and simpler than building custom cloud
> storage, and your files stay entirely in Google's infrastructure with
> Google's own backup/redundancy.

---

## 2. Configure the backend

```bash
cd server
cp .env.example .env
```

Edit `.env`:

```
PORT=4000
ADMIN_PASSWORD=choose-a-strong-password
DRIVE_FOLDER_ID=the-folder-id-from-step-1.7
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account.json
```

Install and run:

```bash
npm install
npm start
```

You should see: `Smriti server running on http://localhost:4000`

The `server.js` file also serves the `public/` folder, so visiting
`http://localhost:4000` shows the student upload page, and
`http://localhost:4000/admin.html` shows the admin page.

---

## 3. Try it locally

1. Open `http://localhost:4000` — add a photo, click **Send to the vault**, watch the progress bar.
2. Open `http://localhost:4000/admin.html`, enter your `ADMIN_PASSWORD`, and confirm the file shows up.
3. Check your actual Google Drive folder — the file should be there too, in full original quality.

---

## 4. Put it online (so students can access it from anywhere)

Any Node-friendly host works. Two easy, free-tier-friendly options:

**Render.com** (simplest)
1. Push this project to a GitHub repo (make sure `.env` and `service-account.json` are excluded via `.gitignore` — already set up).
2. On Render: **New → Web Service** → connect the repo → set root directory to `server`.
3. Add your `.env` values under **Environment**, and upload `service-account.json` as a **Secret File**.
4. Deploy — you'll get a URL like `https://smriti.onrender.com`.

**Railway.app** works almost identically.

Once deployed, share the plain URL (e.g. `https://smriti.onrender.com`)
with your batch — it works the same on iPhone Safari, Android Chrome, and
any laptop browser, since it's just a website.

### Important for large video uploads
If you're on a free hosting tier, check its **request timeout** and
**max upload size** settings — some free tiers cap requests around 100MB
or 30–60 seconds, which will cut off big 4K videos. If students are
sending large videos regularly, a small paid tier (or a VPS like a $5
DigitalOcean droplet with Nginx in front of Node) avoids this entirely.
I'm happy to help configure that once you pick a host.

---

## 5. How it behaves (by design)

- **No student login** — anyone with the link can upload, matching what you asked for.
- **Students can't see others' (or their own) uploaded files afterward** — the page only ever shows their own in-progress selection; once a file finishes, it just gets a "✓ Saved" stamp.
- **Full quality, always** — the server never resizes or compresses; whatever the phone captured is exactly what lands in Drive.
- **Progress bar per file + overall** — shown as a "developing photo" reveal effect.
- **Cancel** — an ✕ on each photo (before or during upload), plus a "Cancel all."
- **Leave-page warning** — if someone tries to close the tab or navigate away mid-upload, the browser shows a native confirmation dialog, plus a small in-app toast.
- **Admin-only viewing** — `/admin.html`, gated by `ADMIN_PASSWORD`, lists every file with a link to open it directly in Drive.

---

## 6. Natural next steps (optional, tell me if you want these built)
- Show upload timestamp / batch name per student.
- Auto-organize into per-student subfolders in Drive.
- Bulk "download all as ZIP" button on the admin page.
- Swap the shared admin password for individual admin logins.
