// Verify password endpoint for URL shortener
// GET /api/link/verify?hash=xxx
// Client sends SHA-256 hash, server compares against stored hash (no crypto.subtle needed)

const PASSWORD_HASH_KEY = '_password_hash';
const DEFAULT_HASH = 'c2073d0f21ad8f56aa780dca6708396ef2c84546d4ad56e55c0eae8db8cb25a8';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const hash = url.searchParams.get('hash') || '';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (!hash) {
    return new Response(JSON.stringify({ valid: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get stored hash from KV
  let storedHash = await env.URL_SHORTENER.get(PASSWORD_HASH_KEY).catch(() => DEFAULT_HASH);
  if (!storedHash) storedHash = DEFAULT_HASH;

  // Compare hashes directly — no crypto needed on server
  const valid = hash === storedHash;

  return new Response(JSON.stringify({ valid }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}