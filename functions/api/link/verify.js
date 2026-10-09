// Verify password endpoint for URL shortener
// GET /api/link/verify?hash=xxx

const PASSWORD_HASH_KEY = '_password_hash';
const DEFAULT_HASH = 'c2073d0f21ad8f56aa780dca6708396ef2c84546d4ad56e55c0eae8db8cb25a8';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const hash = url.searchParams.get('hash') || '';

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (!hash) {
    return new Response(JSON.stringify({ valid: false }), { status: 200, headers });
  }

  // Get stored hash from KV
  var storedHash = DEFAULT_HASH;
  try {
    var value = await env.URL_SHORTENER.get(PASSWORD_HASH_KEY);
    if (value) storedHash = value;
  } catch(e) {
    // KV unavailable — use default
  }

  return new Response(JSON.stringify({ valid: hash === storedHash }), {
    status: 200, headers
  });
}