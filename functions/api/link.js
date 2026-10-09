// API handler for URL shortener CRUD operations
// POST /api/link — create or update a short URL
// GET /api/link?password=... — list all short URLs
// DELETE /api/link — delete a short URL

const PASSWORD_HASH_KEY = '_password_hash';
const LINKS_LIST_KEY = '_links_list';

// Simple SHA-256 hash for password comparison
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(env, password) {
  const storedHash = await env.URL_SHORTENER.get(PASSWORD_HASH_KEY);
  if (!storedHash) {
    // First run: set the password hash
    const hash = await hashPassword(password);
    await env.URL_SHORTENER.put(PASSWORD_HASH_KEY, hash);
    return true;
  }
  const hash = await hashPassword(password);
  return hash === storedHash;
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

  // Get password from Authorization header or query param
  const authHeader = request.headers.get('Authorization') || '';
  const queryPassword = url.searchParams.get('password') || '';
  const password = authHeader.replace(/^Bearer\s+/i, '') || queryPassword;

  if (!password) {
    return new Response(JSON.stringify({ error: 'Password required' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authenticated = await verifyPassword(env, password);
  if (!authenticated) {
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
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

