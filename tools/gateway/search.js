// Search, filter and facet logic over served entries (ARD registry semantics).
'use strict';

function tokens(s) {
  return String(s || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function entryText(e, weight) {
  const fields = [
    [e.representativeQueries, 3],
    [e.displayName, 2],
    [e.description, 1],
    [e.tags, 1],
    [e.capabilities, 1],
    [e['value:kind'], 1],
  ];
  const bag = new Map();
  for (const [v, w] of fields) {
    const arr = Array.isArray(v) ? v : [v];
    for (const s of arr) for (const t of tokens(s)) bag.set(t, Math.max(bag.get(t) || 0, w * (weight || 1)));
  }
  return bag;
}

/** 0..100 semantic-relevance stand-in: weighted overlap of query tokens with the entry's text. */
function score(entry, text) {
  const q = Array.from(new Set(tokens(text)));
  if (!q.length) return 50;
  const bag = entryText(entry);
  let got = 0;
  for (const t of q) if (bag.has(t)) got += bag.get(t);
  const max = q.length * 3;
  return Math.max(0, Math.min(100, Math.round((got / max) * 100)));
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Filter semantics: keys AND, values OR, array-valued fields match if any element matches. */
function matchesFilter(entry, filter) {
  if (!filter || typeof filter !== 'object') return true;
  for (const [key, want] of Object.entries(filter)) {
    if (key === '@context') continue;
    const wanted = (Array.isArray(want) ? want : [want]).map(String);
    const have = getPath(entry, key);
    const haves = (Array.isArray(have) ? have : [have]).filter((v) => v !== undefined && v !== null).map(String);
    if (!haves.some((h) => wanted.includes(h))) return false;
  }
  return true;
}

function facets(entries, spec) {
  const out = {};
  for (const f of spec) {
    const field = typeof f === 'string' ? f : f.field;
    const limit = (f && f.limit) || 20;
    const minCount = (f && f.minCount) || 0;
    const counts = new Map();
    for (const e of entries) {
      const v = getPath(e, field);
      for (const x of Array.isArray(v) ? v : [v]) {
        if (x === undefined || x === null) continue;
        counts.set(String(x), (counts.get(String(x)) || 0) + 1);
      }
    }
    const buckets = Array.from(counts.entries())
      .filter(([, c]) => c >= minCount)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([value, count]) => ({ value, count }));
    const kept = buckets.slice(0, limit);
    out[field] = { buckets: kept, otherCount: buckets.slice(limit).reduce((s, b) => s + b.count, 0) };
  }
  return out;
}

function encodeToken(offset) {
  return Buffer.from(JSON.stringify({ offset })).toString('base64url');
}

function decodeToken(token) {
  if (!token) return 0;
  try {
    return Number(JSON.parse(Buffer.from(token, 'base64url').toString('utf8')).offset) || 0;
  } catch (e) {
    return 0;
  }
}

module.exports = { score, matchesFilter, facets, tokens, encodeToken, decodeToken };
