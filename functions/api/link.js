// API handler for URL shortener CRUD operations
// POST /api/link — create or update a short URL
// GET /api/link — list all short URLs (requires Bearer token = SHA-256 hash)
// DELETE /api/link — delete a short URL

const PASSWORD_HASH_KEY = '_password_hash';
const LINKS_LIST_KEY = '_links_list';
const DEFAULT_HASH = 'c2073d0f21ad8f56aa780dca6708396ef2c84546d4ad56e55c0eae8db8cb25a8';

async function verifyHash(env, hash) {
  const storedHash = await env.URL_SHORTENER.get(PASSWORD_HASH_KEY).catch(() => DEFAULT_HASH);
  return hash === (storedHash || DEFAULT_HASH);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get hash from Authorization header (Bearer token = SHA-256 hash)
  const authHeader = request.headers.get('Authorization') || '';
  const hash = authHeader.replace(/^Bearer\s+/i, '');

  if (!hash) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authenticated = await verifyHash(env, hash);
  if (!authenticated) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (method === 'GET') {
    // List all short URLs
    const linksJson = await env.URL_SHORTENER.get(LINKS_LIST_KEY);
    const links = linksJson ? JSON.parse(linksJson) : {};
    return new Response(JSON.stringify({ success: true, links }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (method === 'POST') {
    // Create or update a short URL
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { slug, url: targetUrl } = body;
    if (!slug || !targetUrl) {
      return new Response(JSON.stringify({ error: 'slug and url are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate slug
    if (!/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/i.test(slug) || slug.length > 50) {
      return new Response(JSON.stringify({ error: 'Invalid slug (alphanumeric, hyphens, underscores, max 50 chars)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate URL
    try {
      new URL(targetUrl);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Save to KV
    await env.URL_SHORTENER.put(slug, targetUrl);

    // Update list index
    const linksJson = await env.URL_SHORTENER.get(LINKS_LIST_KEY);
    const links = linksJson ? JSON.parse(linksJson) : {};
    links[slug] = { url: targetUrl, created: links[slug]?.created || new Date().toISOString(), updated: new Date().toISOString() };
    await env.URL_SHORTENER.put(LINKS_LIST_KEY, JSON.stringify(links));

    return new Response(JSON.stringify({ success: true, slug, url: targetUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (method === 'DELETE') {
    const body = await request.json();
    const { slug } = body;
    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await env.URL_SHORTENER.delete(slug);

    // Update list index
    const linksJson = await env.URL_SHORTENER.get(LINKS_LIST_KEY);
    const links = linksJson ? JSON.parse(linksJson) : {};
    delete links[slug];
    await env.URL_SHORTENER.put(LINKS_LIST_KEY, JSON.stringify(links));

    return new Response(JSON.stringify({ success: true, slug }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

