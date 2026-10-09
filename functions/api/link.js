// API handler for URL shortener CRUD operations
// POST /api/link — create or update a short URL
// GET /api/link — list all short URLs (requires Bearer token = SHA-256 hash)
// DELETE /api/link — delete a short URL

var PASSWORD_HASH_KEY = '_password_hash';
var LINKS_LIST_KEY = '_links_list';
var DEFAULT_HASH = 'c2073d0f21ad8f56aa780dca6708396ef2c84546d4ad56e55c0eae8db8cb25a8';

async function verifyHash(env, hash) {
  try {
    var storedHash = await env.URL_SHORTENER.get(PASSWORD_HASH_KEY);
    if (storedHash) {
      return hash === storedHash;
    }
  } catch (e) {
    // KV unavailable
  }
  return hash === DEFAULT_HASH;
}

export async function onRequest(context) {
  var req = context.request;
  var env = context.env;
  var url = new URL(req.url);
  var method = req.method;

  var corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get hash from Authorization header
  var authHeader = req.headers.get('Authorization') || '';
  var hash = authHeader.replace(/^Bearer\s+/i, '');

  if (!hash) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), {
      status: 401, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
    });
  }

  var authenticated = await verifyHash(env, hash);
  if (!authenticated) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 403, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
    });
  }

  if (method === 'GET') {
    // List all short URLs
    var linksJson = await env.URL_SHORTENER.get(LINKS_LIST_KEY);
    var links = {};
    try { links = JSON.parse(linksJson); } catch (e) {}
    return new Response(JSON.stringify({ success: true, links }), {
      headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
    });
  }

  if (method === 'POST') {
    // Create or update a short URL
    var body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
      });
    }

    var slug = (body.slug || '').trim();
    var targetUrl = (body.url || '').trim();

    if (!slug || !targetUrl) {
      return new Response(JSON.stringify({ error: 'slug and url are required' }), {
        status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
      });
    }

    // Validate slug
    var slugRegex = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/i;
    if (!slugRegex.test(slug) || slug.length > 50) {
      return new Response(JSON.stringify({ error: 'Invalid slug (alphanumeric, hyphens, underscores, max 50 chars)' }), {
        status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
      });
    }

    // Validate URL
    try {
      new URL(targetUrl);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
      });
    }

    // Save to KV
    await env.URL_SHORTENER.put(slug, targetUrl);

    // Update list index
    var linksJson = await env.URL_SHORTENER.get(LINKS_LIST_KEY);
    var links = {};
    try { links = JSON.parse(linksJson); } catch (e) {}
    var now = new Date().toISOString();
    if (links[slug]) {
      links[slug].url = targetUrl;
      links[slug].updated = now;
    } else {
      links[slug] = { url: targetUrl, created: now, updated: now };
    }
    await env.URL_SHORTENER.put(LINKS_LIST_KEY, JSON.stringify(links));

    return new Response(JSON.stringify({ success: true, slug, url: targetUrl }), {
      headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
    });
  }

  if (method === 'DELETE') {
    var body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
      });
    }

    var slug = (body.slug || '').trim();
    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug is required' }), {
        status: 400, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
      });
    }

    await env.URL_SHORTENER.delete(slug);

    // Update list index
    var linksJson = await env.URL_SHORTENER.get(LINKS_LIST_KEY);
    var links = {};
    try { links = JSON.parse(linksJson); } catch (e) {}
    delete links[slug];
    await env.URL_SHORTENER.put(LINKS_LIST_KEY, JSON.stringify(links));

    return new Response(JSON.stringify({ success: true, slug }), {
      headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: Object.assign({}, corsHeaders, { 'Content-Type': 'application/json' })
  });
}