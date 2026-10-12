// models.js
// All the database queries live here, kept separate from the route
// handlers in server.js so each stays easy to read.

const db = require('./db');

// ---------- helpers ----------

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'post';
}

function uniqueSlug(baseTitle, table, excludeId) {
  const base = slugify(baseTitle);
  let slug = base;
  let n = 2;
  const stmt = excludeId
    ? db.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`)
    : db.prepare(`SELECT id FROM ${table} WHERE slug = ?`);
  while (true) {
    const row = excludeId ? stmt.get(slug, excludeId) : stmt.get(slug);
    if (!row) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

function nowIso() {
  return new Date().toISOString();
}

// ---------- settings ----------

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

function getSiteName() {
  return getSetting('site_name', 'My Blog');
}

// ---------- tags ----------

function getAllTags() {
  return db
    .prepare(
      `SELECT tags.*, COUNT(post_tags.post_id) AS post_count
       FROM tags
       LEFT JOIN post_tags ON post_tags.tag_id = tags.id
       LEFT JOIN posts ON posts.id = post_tags.post_id AND posts.published = 1
       GROUP BY tags.id
       ORDER BY tags.name COLLATE NOCASE ASC`
    )
    .all();
}

function getTagBySlug(slug) {
  return db.prepare('SELECT * FROM tags WHERE slug = ?').get(slug);
}

function getTagById(id) {
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
}

function createTag(name) {
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  const existing = db
    .prepare('SELECT * FROM tags WHERE name = ? COLLATE NOCASE')
    .get(trimmed);
  if (existing) return existing;
  const slug = uniqueSlug(trimmed, 'tags');
  const info = db
    .prepare('INSERT INTO tags (name, slug) VALUES (?, ?)')
    .run(trimmed, slug);
  return getTagById(info.lastInsertRowid);
}

function deleteTag(id) {
  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
}

function getTagsForPost(postId) {
  return db
    .prepare(
      `SELECT tags.* FROM tags
       JOIN post_tags ON post_tags.tag_id = tags.id
       WHERE post_tags.post_id = ?
       ORDER BY tags.name COLLATE NOCASE ASC`
    )
    .all(postId);
}

function setPostTags(postId, tagIds) {
  db.prepare('DELETE FROM post_tags WHERE post_id = ?').run(postId);
  const insert = db.prepare(
    'INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)'
  );
  const unique = [...new Set(tagIds.filter(Boolean).map(Number))];
  for (const tagId of unique) insert.run(postId, tagId);
}

// ---------- posts ----------

function attachTags(post) {
  if (!post) return post;
  post.tags = getTagsForPost(post.id);
  return post;
}

function getPostById(id) {
  return attachTags(db.prepare('SELECT * FROM posts WHERE id = ?').get(id));
}

function getPostBySlug(slug) {
  return attachTags(
    db.prepare('SELECT * FROM posts WHERE slug = ? AND published = 1').get(slug)
  );
}

function getRecentPosts(limit) {
  const rows = db
    .prepare(
      `SELECT * FROM posts WHERE published = 1
       ORDER BY created_at DESC, id DESC LIMIT ?`
    )
    .all(limit);
  return rows.map(attachTags);
}

function countPublishedPosts() {
  return db.prepare('SELECT COUNT(*) AS c FROM posts WHERE published = 1').get().c;
}

function getPostsPage(page, pageSize) {
  const total = countPublishedPosts();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * pageSize;
  const rows = db
    .prepare(
      `SELECT * FROM posts WHERE published = 1
       ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
    )
    .all(pageSize, offset);
  return { posts: rows.map(attachTags), total, totalPages, page: safePage };
}

function countPublishedPostsByTag(tagId) {
  return db
    .prepare(
      `SELECT COUNT(*) AS c FROM posts
       JOIN post_tags ON post_tags.post_id = posts.id
       WHERE post_tags.tag_id = ? AND posts.published = 1`
    )
    .get(tagId).c;
}

function getPostsByTagPage(tagId, page, pageSize) {
  const total = countPublishedPostsByTag(tagId);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * pageSize;
  const rows = db
    .prepare(
      `SELECT posts.* FROM posts
       JOIN post_tags ON post_tags.post_id = posts.id
       WHERE post_tags.tag_id = ? AND posts.published = 1
       ORDER BY posts.created_at DESC, posts.id DESC LIMIT ? OFFSET ?`
    )
    .all(tagId, pageSize, offset);
  return { posts: rows.map(attachTags), total, totalPages, page: safePage };
}

function getAllPostsForAdmin() {
  const rows = db.prepare('SELECT * FROM posts ORDER BY created_at DESC, id DESC').all();
  return rows.map(attachTags);
}

function createPost({ title, content, tagIds, published }) {
  const slug = uniqueSlug(title, 'posts');
  const now = nowIso();
  const info = db
    .prepare(
      `INSERT INTO posts (title, slug, content, published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(title, slug, content, published ? 1 : 0, now, now);
  const id = info.lastInsertRowid;
  setPostTags(id, tagIds || []);
  return getPostById(id);
}

function updatePost(id, { title, content, tagIds, published }) {
  const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  if (!existing) return null;
  const slug =
    title && title !== existing.title
      ? uniqueSlug(title, 'posts', id)
      : existing.slug;
  db.prepare(
    `UPDATE posts SET title = ?, slug = ?, content = ?, published = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    title,
    slug,
    content,
    published ? 1 : 0,
    nowIso(),
    id
  );
  setPostTags(id, tagIds || []);
  return getPostById(id);
}

function deletePost(id) {
  db.prepare('DELETE FROM posts WHERE id = ?').run(id);
}

module.exports = {
  slugify,
  getSetting,
  setSetting,
  getSiteName,
  getAllTags,
  getTagBySlug,
  getTagById,
  createTag,
  deleteTag,
  getTagsForPost,
  setPostTags,
  getPostById,
  getPostBySlug,
  getRecentPosts,
  getPostsPage,
  getPostsByTagPage,
  getAllPostsForAdmin,
  createPost,
  updatePost,
  deletePost,
};
