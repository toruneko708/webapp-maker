const MAX_BLUESKY_CHARS = 300;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function unauthorized() {
  return json({ error: 'Unauthorized' }, 401);
}

function isAuthorized(request, env) {
  return request.headers.get('authorization') === `Bearer ${env.SCHEDULER_TOKEN?.trim()}`;
}

function linkFacets(text) {
  const encoder = new TextEncoder();
  const facets = [];
  const urls = /https?:\/\/[^\s<>()]+/g;
  for (const match of text.matchAll(urls)) {
    const start = encoder.encode(text.slice(0, match.index)).length;
    const end = start + encoder.encode(match[0]).length;
    facets.push({
      index: { byteStart: start, byteEnd: end },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: match[0] }]
    });
  }
  return facets;
}

async function blueskySession(env) {
  const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: env.BLUESKY_HANDLE?.trim(), password: env.BLUESKY_APP_PASSWORD?.trim() })
  });
  if (!response.ok) throw new Error(`Bluesky login failed (${response.status})`);
  return response.json();
}

async function postToBluesky(env, text) {
  const session = await blueskySession(env);
  const record = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date().toISOString(),
    langs: ['ja']
  };
  const facets = linkFacets(text);
  if (facets.length) record.facets = facets;
  const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessJwt}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ repo: session.did, collection: 'app.bsky.feed.post', record })
  });
  if (!response.ok) throw new Error(`Bluesky post failed (${response.status})`);
  return response.json();
}

async function notifyDiscord(env, task, blueskyUri) {
  const postUrl = `https://bsky.app/profile/${env.BLUESKY_HANDLE}/post/${blueskyUri.split('/').pop()}`;
  const copyText = `${task.x_text.trim()}\n`;
  const form = new FormData();
  form.append('payload_json', JSON.stringify({
    content: `@everyone 予約投稿をBlueskyへ公開しました。\n${postUrl}\n\nX転載用の本文は添付TXTをそのままコピーしてください。`,
    allowed_mentions: { parse: ['everyone'] }
  }));
  form.append('files[0]', new Blob([copyText], { type: 'text/plain; charset=utf-8' }), 'x-post.txt');
  const response = await fetch(env.DISCORD_WEBHOOK_URL?.trim(), { method: 'POST', body: form });
  if (!response.ok) throw new Error(`Discord notification failed (${response.status})`);
  return response;
}

async function dispatchTask(env, task) {
  const claimed = await env.DB.prepare(
    "UPDATE scheduled_posts SET status = 'processing', attempts = attempts + 1 WHERE id = ? AND status = 'queued'"
  ).bind(task.id).run();
  if (!claimed.meta?.changes) return;

  const current = await env.DB.prepare('SELECT * FROM scheduled_posts WHERE id = ?').bind(task.id).first();
  if (!current || current.status !== 'processing') return;

  try {
    let blueskyUri = current.bluesky_uri;
    if (!blueskyUri) {
      const result = await postToBluesky(env, current.bluesky_text);
      blueskyUri = result.uri;
      await env.DB.prepare('UPDATE scheduled_posts SET bluesky_uri = ? WHERE id = ?').bind(blueskyUri, current.id).run();
    }
    await notifyDiscord(env, current, blueskyUri);
    await env.DB.prepare(
      "UPDATE scheduled_posts SET status = 'sent', sent_at = ?, last_error = NULL WHERE id = ?"
    ).bind(new Date().toISOString(), current.id).run();
  } catch (error) {
    await env.DB.prepare(
      "UPDATE scheduled_posts SET status = 'queued', last_error = ? WHERE id = ?"
    ).bind(String(error).slice(0, 500), current.id).run();
  }
}

async function dispatchDue(env) {
  const now = new Date().toISOString();
  const { results } = await env.DB.prepare(
    "SELECT * FROM scheduled_posts WHERE status = 'queued' AND run_at <= ? ORDER BY run_at LIMIT 10"
  ).bind(now).all();
  await Promise.all(results.map(task => dispatchTask(env, task)));
}

async function createTask(request, env) {
  const body = await request.json();
  const runAt = new Date(body.runAt);
  const blueskyText = String(body.blueskyText || '').trim();
  const xText = String(body.xText || blueskyText).trim();
  if (Number.isNaN(runAt.valueOf()) || runAt <= new Date()) return json({ error: 'runAt must be a future ISO-8601 time' }, 400);
  if (!blueskyText || blueskyText.length > MAX_BLUESKY_CHARS || !xText) return json({ error: 'Invalid post text' }, 400);

  const task = {
    id: crypto.randomUUID(),
    runAt: runAt.toISOString(),
    blueskyText,
    xText,
    createdAt: new Date().toISOString()
  };
  await env.DB.prepare(
    'INSERT INTO scheduled_posts (id, run_at, bluesky_text, x_text, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(task.id, task.runAt, task.blueskyText, task.xText, task.createdAt).run();
  return json(task, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true });
    if (!isAuthorized(request, env)) return unauthorized();
    if (request.method === 'POST' && url.pathname === '/tasks') return createTask(request, env);
    if (request.method === 'GET' && url.pathname === '/tasks') {
      const { results } = await env.DB.prepare(
        'SELECT id, run_at, bluesky_text, x_text, status, bluesky_uri, attempts, last_error, created_at, sent_at FROM scheduled_posts ORDER BY run_at DESC LIMIT 50'
      ).all();
      return json({ tasks: results });
    }
    return json({ error: 'Not found' }, 404);
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(dispatchDue(env));
  }
};
