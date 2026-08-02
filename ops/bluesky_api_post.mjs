#!/usr/bin/env node
// Bluesky API helper for the SNS drafts in this directory.
// Credentials are read only from environment variables and are never written to disk.

import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const draftDir = path.join(root, 'work');

function usage() {
  console.log(`使い方:
  node work/bluesky_api_post.mjs --list
  node work/bluesky_api_post.mjs --file work/sns_dealshield.json --dry-run
  node work/bluesky_api_post.mjs --text "テスト投稿" --post --confirm
  node work/bluesky_api_post.mjs --profile --confirm
  node work/bluesky_api_post.mjs --file work/sns_dealshield.json --post --confirm

投稿時に必要な環境変数:
  BLUESKY_HANDLE=あなたのハンドル
  BLUESKY_APP_PASSWORD=Blueskyのアプリパスワード

--post は --confirm がないと実行しません。`);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function extractPosts(content) {
  const fenced = [...content.matchAll(/```(?:text)?\s*\r?\n([\s\S]*?)```/g)]
    .map(match => match[1].trim())
    .filter(Boolean);
  return fenced.length ? fenced : [content.trim()];
}

async function loadDraft(fileArg) {
  const file = fileArg || path.join('work', 'sns_dealshield.json');
  const filePath = path.resolve(root, file);
  const raw = (await fs.readFile(filePath, 'utf8')).replace(/^\uFEFF/, '');
  const data = JSON.parse(raw);
  const posts = extractPosts(String(data.content || ''));
  return { filePath, posts };
}

async function listDrafts() {
  const files = (await fs.readdir(draftDir))
    .filter(name => name.startsWith('sns_') && name.endsWith('.json'))
    .sort();
  for (const name of files) {
    const { posts } = await loadDraft(path.join('work', name));
    console.log(`${name}\t${posts.length}投稿`);
  }
}

async function createSession(handle, password) {
  const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: handle, password })
  });
  if (!response.ok) throw new Error(`ログイン失敗: HTTP ${response.status} ${await response.text()}`);
  return response.json();
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

async function createPost(session, text, reply) {
  const record = {
    $type: 'app.bsky.feed.post',
    text,
    createdAt: new Date().toISOString(),
    langs: ['ja']
  };
  const facets = linkFacets(text);
  if (facets.length) record.facets = facets;
  if (reply) record.reply = reply;
  const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessJwt}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ repo: session.did, collection: 'app.bsky.feed.post', record })
  });
  if (!response.ok) throw new Error(`投稿失敗: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

async function updateProfile(session, description) {
  const getResponse = await fetch(`https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(session.did)}&collection=app.bsky.actor.profile&rkey=self`, {
    headers: { authorization: `Bearer ${session.accessJwt}` }
  });
  if (!getResponse.ok) throw new Error(`プロフィール取得失敗: HTTP ${getResponse.status} ${await getResponse.text()}`);
  const current = await getResponse.json();
  const record = { ...current.value, description };
  const putResponse = await fetch('https://bsky.social/xrpc/com.atproto.repo.putRecord', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessJwt}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
      record
    })
  });
  if (!putResponse.ok) throw new Error(`プロフィール更新失敗: HTTP ${putResponse.status} ${await putResponse.text()}`);
  return putResponse.json();
}

const command = process.argv.includes('--list') ? 'list'
  : process.argv.includes('--profile') ? 'profile'
  : process.argv.includes('--post') ? 'post'
  : process.argv.includes('--dry-run') ? 'dry-run'
  : null;

if (!command) {
  usage();
  process.exitCode = 1;
} else if (command === 'list') {
  await listDrafts();
} else if (command === 'profile') {
  if (!process.argv.includes('--confirm')) throw new Error('プロフィール更新は --confirm を付けた場合だけ実行します。');
  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !password) throw new Error('BLUESKY_HANDLE と BLUESKY_APP_PASSWORD を環境変数に設定してください。');
  const description = arg('--bio') || 'フリーランスの判断を、順番からつくる。請求書・実質時給・取引防衛・トラブル記録の無料Webアプリを制作中。正解より、先に何を捨てるか。junban.dev';
  const session = await createSession(handle, password);
  const result = await updateProfile(session, description);
  console.log(`プロフィール更新成功: ${result.uri}`);
} else {
  const textArg = arg('--text');
  const loaded = textArg ? { filePath: '(直接指定)', posts: [textArg] } : await loadDraft(arg('--file'));
  const { filePath, posts } = loaded;
  console.log(`原稿: ${filePath}`);
  console.log(`投稿数: ${posts.length}`);
  posts.forEach((post, i) => console.log(`\n--- ${i + 1}/${posts.length} (${post.length}文字) ---\n${post}`));

  if (command === 'dry-run') process.exit(0);
  if (!process.argv.includes('--confirm')) {
    throw new Error('公開投稿は --confirm を付けた場合だけ実行します。');
  }

  const handle = process.env.BLUESKY_HANDLE;
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!handle || !password) {
    throw new Error('BLUESKY_HANDLE と BLUESKY_APP_PASSWORD を環境変数に設定してください。');
  }

  const session = await createSession(handle, password);
  let reply;
  for (const post of posts) {
    const result = await createPost(session, post, reply);
    console.log(`投稿成功: ${result.uri}`);
    const rootRef = reply?.root || { uri: result.uri, cid: result.cid };
    reply = { root: rootRef, parent: { uri: result.uri, cid: result.cid } };
  }
}
