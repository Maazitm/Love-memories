// Smriti — by Dwani Academy
// Backend: receives uploads from students and streams them straight to
// a Google Drive folder using a service account (no student login needed,
// no OAuth popups — it just works on any phone or laptop browser).

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { google } = require('googleapis');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;

// ---------- Config ----------
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID; // the Drive folder that receives uploads
const KEYFILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, 'service-account.json');

if (!DRIVE_FOLDER_ID) {
  console.warn('⚠️  DRIVE_FOLDER_ID is not set in .env — uploads will fail until you add it.');
}

// ---------- Google Drive auth ----------
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILE,
  scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = google.drive({ version: 'v3', auth });

// ---------- Temp upload storage (handles large 4K video safely) ----------
const TMP_DIR = path.join(os.tmpdir(), 'smriti-uploads');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TMP_DIR),
  filename: (req, file, cb) => {
    const unique = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${unique}-${file.originalname}`);
  },
});

// No file-size cap — students are sending original-quality photos/videos.
// Increase server/proxy timeouts accordingly (see README).
const upload = multer({ storage });

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- Health check ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------- Student upload endpoint ----------
// One file per request — the frontend uploads files one at a time (or a
// few in parallel) so each gets its own accurate progress bar.
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, message: 'No file received.' });
  }

  const studentName = (req.body.studentName || 'Unknown').trim().slice(0, 80);
  const localPath = req.file.path;

  try {
    if (!DRIVE_FOLDER_ID) {
      throw new Error('Server is not configured with a Drive folder yet.');
    }

    const driveResponse = await drive.files.create({
      requestBody: {
        name: req.file.originalname,
        parents: [DRIVE_FOLDER_ID],
        // Keep the uploader's name in the description so admin can trace it.
        description: `Uploaded by: ${studentName}`,
      },
      media: {
        mimeType: req.file.mimetype,
        body: fs.createReadStream(localPath),
      },
      fields: 'id, name, size, webViewLink',
    });

    fs.unlink(localPath, () => {}); // clean up temp file, ignore errors

    return res.json({
      ok: true,
      message: 'Uploaded successfully.',
      fileId: driveResponse.data.id,
      name: driveResponse.data.name,
    });
  } catch (err) {
    fs.unlink(localPath, () => {});
    console.error('Upload failed:', err.message);
    return res.status(500).json({ ok: false, message: 'Upload failed. Please try again.' });
  }
});

// ---------- Admin auth ----------
// Simple shared-password gate — good enough for a batch project, not meant
// for storing anything highly sensitive. Swap for real auth later if needed.
function requireAdmin(req, res, next) {
  const password = req.header('x-admin-password');
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: 'Wrong password.' });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, message: 'Wrong password.' });
});

// Students never hit this — only the admin dashboard calls it, with the
// password header attached.
app.get('/api/admin/files', requireAdmin, async (req, res) => {
  try {
    const result = await drive.files.list({
      q: `'${DRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType, size, createdTime, webViewLink, thumbnailLink, description)',
      orderBy: 'createdTime desc',
      pageSize: 1000,
    });
    res.json({ ok: true, files: result.data.files });
  } catch (err) {
    console.error('Failed to list files:', err.message);
    res.status(500).json({ ok: false, message: 'Could not load files.' });
  }
});

app.listen(PORT, () => {
  console.log(`Smriti server running on http://localhost:${PORT}`);
});
