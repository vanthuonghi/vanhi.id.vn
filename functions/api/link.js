// Minimal test for link API
var DEFAULT_HASH = 'c2073d0f21ad8f56aa780dca6708396ef2c84546d4ad56e55c0eae8db8cb25a8';

export async function onRequest(context) {
  var req = context.request;
  var env = context.env;
  var url = new URL(req.url);
  var method = req.method;

  var cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
    'content-type': 'application/json',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: cors });
  }

  // Get hash from header
  var auth = req.headers.get('Authorization') || '';
  var hash = auth.slice(7); // remove 'Bearer '
  
  if (!hash || hash !== DEFAULT_HASH) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: cors
    });
  }

  if (method === 'GET') {
    try {
      var data = await env.URL_SHORTENER.get('_links_list');
      var links = data ? JSON.parse(data) : {};
      return new Response(JSON.stringify({ success: true, links: links }), {
        headers: cors
      });
    } catch (e) {
      return new Response(JSON.stringify({ success: true, links: {} }), {
        headers: cors
      });
    }
  }

  if (method === 'POST') {
    try {
      var body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'invalid json' }), {
        status: 400, headers: cors
      });
    }
    var slug = body.slug;
    var turl = body.url;
    if (!slug || !turl) {
      return new Response(JSON.stringify({ error: 'slug and url required' }), {
        status: 400, headers: cors
      });
    }
    try {
      var kv = env.URL_SHORTENER;
      if (!kv) {
        return new Response(JSON.stringify({ error: 'kv binding missing', check: typeof env, keys: Object.keys(env).join(',') }), {
          status: 500, headers: cors
        });
      }
      await kv.put(slug, turl);
      var data = await kv.get('_links_list');
      var links = data ? JSON.parse(data) : {};
      var now = new Date().toISOString();
      if (links[slug]) {
        links[slug].url = turl;
        links[slug].updated = now;
      } else {
        links[slug] = { url: turl, created: now, updated: now };
      }
      await env.URL_SHORTENER.put('_links_list', JSON.stringify(links));
      return new Response(JSON.stringify({ success: true, slug: slug, url: turl }), {
        headers: cors
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'kv error: ' + e.message }), {
        status: 500, headers: cors
      });
    }
  }

  if (method === 'DELETE') {
    try {
      var body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'invalid json' }), {
        status: 400, headers: cors
      });
    }
    var slug = body.slug;
    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug required' }), {
        status: 400, headers: cors
      });
    }
    try {
      await env.URL_SHORTENER.delete(slug);
      var data = await env.URL_SHORTENER.get('_links_list');
      var links = data ? JSON.parse(data) : {};
      delete links[slug];
      await env.URL_SHORTENER.put('_links_list', JSON.stringify(links));
      return new Response(JSON.stringify({ success: true }), { headers: cors });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'kv error' }), {
        status: 500, headers: cors
      });
    }
  }

  return new Response(JSON.stringify({ error: 'method not allowed' }), {
    status: 405, headers: cors
  });
}