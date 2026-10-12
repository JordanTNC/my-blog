// utils.js — small helpers shared by the routes and views.

// Builds a compact list of page numbers for pagination links, e.g. for
// page 4 of 10 it returns: 1, ..., 3, 4, 5, ..., 10
// Each entry is either { ellipsis: true } or { page, current }.
function getPageList(current, total) {
  if (total <= 1) return [];
  const keep = new Set([1, total, current]);
  if (current - 1 >= 1) keep.add(current - 1);
  if (current + 1 <= total) keep.add(current + 1);
  const sorted = [...keep].sort((a, b) => a - b);

  const result = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push({ ellipsis: true });
    result.push({ page: p, current: p === current });
    prev = p;
  }
  return result;
}

// "September 18, 2026, 4:05 PM" style formatting in a fixed, readable form.
function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// A short plain-text preview of the HTML content, for list views.
function excerpt(html, maxLen = 200) {
  const text = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}

module.exports = { getPageList, formatDateTime, formatDate, excerpt };
