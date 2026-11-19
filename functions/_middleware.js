// URL Shortener Middleware — redirect short links stored in links.json (GitHub).
// Data source: https://raw.githubusercontent.com/vanthuonghi/vanhi.id.vn/main/links.json
// Không cần KV binding: dữ liệu nằm trong repo, cache 60 giây ở edge.

const LINKS_URL = 'https://raw.githubusercontent.com/vanthuonghi/vanhi.id.vn/main/links.json';
const CACHE_TTL_MS = 60000;

const STATIC_PREFIXES = [
  '/css/', '/js/', '/images/', '/favicon', '/og-image',
  '/sitemap', '/robots.txt', '/_headers', '/links.json',
  '/.well-known/', '/cdn-cgi/'
];

const RESERVED_PATHS = [
  '/link', '/api/', '/blog/', '/giai-phap/', '/youtube/',
  '/qua-tang/', '/cong-cu-ai/', '/lien-he/', '/tags/', '/categories/'
];

let cache = { at: 0, links: null };

async function loadLinks() {
  const now = Date.now();
  if (cache.links && now - cache.at < CACHE_TTL_MS) return cache.links;

  try {
    const res = await fetch(LINKS_URL, { cf: { cacheEverything: true, cacheTtl: 60 } });
    if (!res.ok) throw new Error('links.json HTTP ' + res.status);
    const data = await res.json();
    const links = (data && (data.links || data)) || {};
    cache = { at: now, links: links };
    return links;
  } catch (e) {
    console.error('links.json load failed:', e.message);
    return cache.links || {};
  }
}

function targetOf(entry) {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry.url === 'string') return entry.url;
  return '';
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Let static assets and reserved paths pass through
  if (STATIC_PREFIXES.some(p => path.startsWith(p))) return next();
  if (RESERVED_PATHS.some(p => path.startsWith(p))) return next();

  // Root path — pass through
  if (path === '/' || path === '') return next();

  const slug = path.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!slug || slug.includes('/')) return next();

  const links = await loadLinks();
  const raw = targetOf(links[slug]);
  if (!raw) return next();

  let target;
  try {
    target = new URL(raw);
  } catch (e) {
    return next();
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return next();

  // Giữ query string (vd. ?utm_source=...) khi redirect
  if (url.search) {
    const extra = url.search.slice(1);
    target.search = target.search ? target.search + '&' + extra : '?' + extra;
  }

  return Response.redirect(target.toString(), 302);
}
