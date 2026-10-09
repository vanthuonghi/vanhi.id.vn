// Verify password endpoint for URL shortener
// GET /api/link/verify?password=xxx

const PASSWORD_HASH_KEY = '_password_hash';

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
  const password = url.searchParams.get('password') || '';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (!password) {
    return new Response(JSON.stringify({ valid: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authenticated = await verifyPassword(env, password);
  return new Response(JSON.stringify({ valid: authenticated }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}