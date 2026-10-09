// URL Shortener Middleware — intercept unknown paths, check KV for short URLs
// Skip static paths, API routes, and existing pages

const STATIC_PREFIXES = [
  '/css/', '/js/', '/images/', '/favicon', '/og-image', 
  '/sitemap', '/robots.txt', '/_headers',
  '/.well-known/', '/cdn-cgi/'
];

const RESERVED_PATHS = [
  '/link', '/api/', '/blog/', '/giai-phap/', '/youtube/',
  '/qua-tang/', '/cong-cu-ai/', '/lien-he/', '/tags/', '/categories/'
];

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Let static assets and reserved paths pass through
  if (STATIC_PREFIXES.some(p => path.startsWith(p))) return next();
  if (RESERVED_PATHS.some(p => path.startsWith(p))) return next();
  
  // Root path — pass through
  if (path === '/' || path === '') return next();

  // Check KV for short URL
  const shortUrl = path.slice(1); // remove leading /
  try {
    const target = await env.URL_SHORTENER.get(shortUrl);
    if (target) {
      // Valid short URL — redirect with 301 (permanent) or 302 (temporary)
      return Response.redirect(target, 302);
    }
  } catch (e) {
    // KV error — pass through
    console.error('KV error:', e);
  }

  // Not found in KV — let Hugo handle it (will return its own 404)
  return next();
}