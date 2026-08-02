#!/usr/bin/env node
import fs from 'node:fs/promises';

const args = process.argv.slice(2);
const value = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const at = value('--at');
const blueskyFile = value('--bluesky-file');
const xFile = value('--x-file') || blueskyFile;
if (!at || !blueskyFile || !process.env.SCHEDULER_URL || !process.env.SCHEDULER_TOKEN) {
  throw new Error('Usage: --at <ISO-8601> --bluesky-file <txt> [--x-file <txt>] (requires SCHEDULER_URL and SCHEDULER_TOKEN)');
}

const [blueskyText, xText] = await Promise.all([
  fs.readFile(blueskyFile, 'utf8'),
  fs.readFile(xFile, 'utf8')
]);
const response = await fetch(`${process.env.SCHEDULER_URL.replace(/\/$/, '')}/tasks`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${process.env.SCHEDULER_TOKEN}`,
    'content-type': 'application/json'
  },
  body: JSON.stringify({ runAt: at, blueskyText, xText })
});
const result = await response.json();
if (!response.ok) throw new Error(JSON.stringify(result));
console.log(`予約完了: ${result.id} / ${result.runAt}`);
