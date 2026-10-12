require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const models = require('./models');
const { getPageList, formatDateTime, formatDate, excerpt } = require('./utils');

const app = express();

const PORT = process.env.PORT || 3000;
const HOME_RECENT_COUNT = 15;
const PAGE_SIZE = 30;

const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- view engine & static assets ----------

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve the rich-text editor library straight out of node_modules so there's
// no separate build step -- `npm install` is all that's needed.
app.use('/vendor/quill', express.static(path.join(__dirname, 'node_modules', 'quill', 'dist')));
app.use(
  '/vendor/image-resize',
  express.static(path.join(__dirname, 'node_modules', 'quill-image-resize-module-fix'))
);

// ---------- sessions ----------

const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn(
    'Warning: SESSION_SECRET is not set in .env. Using a random one-time secret, ' +
      'which means everyone will be logged out whenever the server restarts. ' +
      'Run `npm run create-admin` to set one permanently.'
  );
}

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// Make the site name available to every view without passing it every time.
app.use((req, res, next) => {
  res.locals.siteName = models.getSiteName();
  res.locals.isAdmin = !!(req.session && req.session.isAdmin);
  res.locals.allTags = models.getAllTags();
  next();
});

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl));
}

function adminConfigured() {
  return !!process.env.ADMIN_PASSWORD_HASH;
}

// ---------- image uploads (used by the editor's image button) ----------

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf'];
    const safeExt = allowed.includes(ext) ? ext : file.mimetype === 'application/pdf' ? '.pdf' : '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files can be uploaded.'));
  },
});

// Separate uploader for file attachments (currently just PDFs) linked from
// inside a post, as opposed to images embedded in it.
const uploadFile = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files can be attached.'));
  },
});

// ================= PUBLIC ROUTES =================

app.get('/', (req, res) => {
  const recent = models.getRecentPosts(HOME_RECENT_COUNT);
  res.render('index', {
    title: res.locals.siteName,
    recent,
    hasMore: recent.length === HOME_RECENT_COUNT,
    formatDateTime,
    excerpt,
  });
});

app.get('/articles', (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const { posts, totalPages, page: safePage } = models.getPostsPage(page, PAGE_SIZE);
  res.render('articles', {
    title: `All Articles – ${res.locals.siteName}`,
    heading: 'All Articles',
    posts,
    page: safePage,
    totalPages,
    pageList: getPageList(safePage, totalPages),
    baseUrl: '/articles',
    formatDateTime,
    excerpt,
  });
});

app.get('/category/:slug', (req, res) => {
  const tag = models.getTagBySlug(req.params.slug);
  if (!tag) return res.status(404).render('404', { title: 'Not Found' });
  const page = parseInt(req.query.page, 10) || 1;
  const { posts, totalPages, page: safePage } = models.getPostsByTagPage(
    tag.id,
    page,
    PAGE_SIZE
  );
  res.render('articles', {
    title: `${tag.name} – ${res.locals.siteName}`,
    heading: `Category: ${tag.name}`,
    posts,
    page: safePage,
    totalPages,
    pageList: getPageList(safePage, totalPages),
    baseUrl: `/category/${tag.slug}`,
    formatDateTime,
    excerpt,
  });
});

app.get('/post/:slug', (req, res) => {
  const post = models.getPostBySlug(req.params.slug);
  if (!post) return res.status(404).render('404', { title: 'Not Found' });
  const wasEdited =
    new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 60000;
  res.render('post', {
    title: `${post.title} – ${res.locals.siteName}`,
    post,
    wasEdited,
    formatDateTime,
  });
});

// ================= ADMIN: AUTH =================

app.get('/admin/login', (req, res) => {
  res.render('admin/login', {
    title: `Log in – ${res.locals.siteName}`,
    error: null,
    configured: adminConfigured(),
    next: req.query.next || '/admin',
  });
});

app.post('/admin/login', (req, res) => {
  const { username, password, next } = req.body;
  const nextUrl = next && next.startsWith('/') ? next : '/admin';

  if (!adminConfigured()) {
    return res.status(500).render('admin/login', {
      title: `Log in – ${res.locals.siteName}`,
      error: null,
      configured: false,
      next: nextUrl,
    });
  }

  const validUser = username === process.env.ADMIN_USERNAME;
  const validPass =
    validUser && bcrypt.compareSync(password || '', process.env.ADMIN_PASSWORD_HASH);

  if (!validUser || !validPass) {
    return res.status(401).render('admin/login', {
      title: `Log in – ${res.locals.siteName}`,
      error: 'Incorrect username or password.',
      configured: true,
      next: nextUrl,
    });
  }

  req.session.isAdmin = true;
  res.redirect(nextUrl);
});

app.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ================= ADMIN: DASHBOARD =================

app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin/dashboard', {
    title: `Dashboard – ${res.locals.siteName}`,
    posts: models.getAllPostsForAdmin(),
    formatDateTime,
    siteName: res.locals.siteName,
  });
});

app.post('/admin/settings', requireAdmin, (req, res) => {
  const name = (req.body.siteName || '').trim();
  if (name) models.setSetting('site_name', name);
  res.redirect('/admin');
});

// ---- tags ----

app.post('/admin/tags', requireAdmin, (req, res) => {
  const name = (req.body.name || '').trim();
  if (name) models.createTag(name);
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ tags: models.getAllTags() });
  }
  res.redirect('/admin');
});

app.post('/admin/tags/:id/delete', requireAdmin, (req, res) => {
  models.deleteTag(req.params.id);
  res.redirect('/admin');
});

// ---- image upload for the editor ----

app.post('/admin/upload-image', requireAdmin, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received.' });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

// ---- PDF (and other file) attachments linked from inside a post ----

app.post('/admin/upload-file', requireAdmin, (req, res) => {
  uploadFile.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file received.' });
    res.json({
      url: `/uploads/${req.file.filename}`,
      filename: req.file.originalname,
    });
  });
});

// ---- create / edit / delete posts ----

function parseTagIds(body) {
  let ids = body.tags || [];
  if (!Array.isArray(ids)) ids = [ids];
  return ids.map(Number).filter((n) => !Number.isNaN(n));
}

function createNewTagsFromInput(input) {
  if (!input) return [];
  return String(input)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => models.createTag(name).id);
}

app.get('/admin/new', requireAdmin, (req, res) => {
  res.render('admin/edit', {
    title: `New Post – ${res.locals.siteName}`,
    post: null,
    formAction: '/admin/new',
  });
});

app.post('/admin/new', requireAdmin, (req, res) => {
  const { title, content } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).render('admin/edit', {
      title: `New Post – ${res.locals.siteName}`,
      post: { title, content, tags: [] },
      formAction: '/admin/new',
      error: 'Please give the post a title.',
    });
  }
  const tagIds = [...parseTagIds(req.body), ...createNewTagsFromInput(req.body.newTags)];
  const post = models.createPost({
    title: title.trim(),
    content: content || '',
    tagIds,
    published: req.body.published === 'on',
  });
  res.redirect(`/admin/edit/${post.id}?saved=1`);
});

app.get('/admin/edit/:id', requireAdmin, (req, res) => {
  const post = models.getPostById(req.params.id);
  if (!post) return res.status(404).render('404', { title: 'Not Found' });
  res.render('admin/edit', {
    title: `Edit – ${res.locals.siteName}`,
    post,
    formAction: `/admin/edit/${post.id}`,
    saved: req.query.saved === '1',
  });
});

app.post('/admin/edit/:id', requireAdmin, (req, res) => {
  const { title, content } = req.body;
  const tagIds = [...parseTagIds(req.body), ...createNewTagsFromInput(req.body.newTags)];
  const post = models.updatePost(req.params.id, {
    title: (title || '').trim(),
    content: content || '',
    tagIds,
    published: req.body.published === 'on',
  });
  if (!post) return res.status(404).render('404', { title: 'Not Found' });
  res.redirect(`/admin/edit/${post.id}?saved=1`);
});

app.post('/admin/delete/:id', requireAdmin, (req, res) => {
  models.deletePost(req.params.id);
  res.redirect('/admin');
});

// ================= 404 =================

app.use((req, res) => {
  res.status(404).render('404', { title: 'Not Found' });
});

app.listen(PORT, () => {
  console.log(`Blog running at http://localhost:${PORT}`);
  if (!adminConfigured()) {
    console.log('No admin account set up yet -- run `npm run create-admin` to create one.');
  }
});
