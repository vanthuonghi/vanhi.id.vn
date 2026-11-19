// Danh sách short link (chỉ đọc). Dữ liệu nằm ở links.json trong repo,
// trang quản trị /link ghi trực tiếp qua GitHub API.

const LINKS_URL = 'https://raw.githubusercontent.com/vanthuonghi/vanhi.id.vn/main/links.json';
const CACHE_TTL_MS = 60000;

let cache = { at: 0, links: null };

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization',
  'content-type': 'application/json',
  'cache-control': 'public, max-age=60',
};

async function loadLinks() {
  const now = Date.now();
  if (cache.links && now - cache.at < CACHE_TTL_MS) return cache.links;
  try {
    const bucket = Math.floor(now / CACHE_TTL_MS);
    const res = await fetch(LINKS_URL + '?v=' + bucket, { cf: { cacheEverything: true, cacheTtl: 60 } });
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

export async function onRequest(context) {
  const req = context.request;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  if (req.method === 'GET') {
    const links = await loadLinks();
    return new Response(JSON.stringify({ success: true, links: links }), { headers: cors });
  }

  return new Response(
    JSON.stringify({
      error: 'read_only',
      message: 'Short link được lưu trong links.json của repo. Quản lý tại /link.',
    }),
    { status: 501, headers: cors }
  );
}
