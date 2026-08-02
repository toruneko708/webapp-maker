# Junban Social Scheduler

Cloudflare Worker + D1 に予約を保存し、指定時刻にBlueskyへ投稿します。投稿成功後、Discord Webhookへ `@everyone` の通知と、Xへ転載する文面を入れた `x-post.txt` を添付します。

## Secrets（Gitへ保存しない）

Cloudflare Workerには次のSecretを設定する。

- `BLUESKY_HANDLE`
- `BLUESKY_APP_PASSWORD`
- `DISCORD_WEBHOOK_URL`
- `SCHEDULER_TOKEN`（十分に長いランダム文字列）

ローカルCLIには `SCHEDULER_URL` と `SCHEDULER_TOKEN` だけを非公開の環境変数で渡す。

## 初回セットアップ

```powershell
cd work/social-scheduler
npx wrangler d1 create junban-social-scheduler
# 表示された database_id を wrangler.toml のプレースホルダーへ反映
npx wrangler d1 execute junban-social-scheduler --remote --file=./schema.sql
npx wrangler deploy
npx wrangler secret put BLUESKY_HANDLE
npx wrangler secret put BLUESKY_APP_PASSWORD
npx wrangler secret put DISCORD_WEBHOOK_URL
npx wrangler secret put SCHEDULER_TOKEN
```

## 投稿予約

Bluesky用とX用のTXTを用意する。X用を省略するとBluesky用と同じ文面が添付される。

```powershell
$env:SCHEDULER_URL = 'https://junban-social-scheduler.<account>.workers.dev'
$env:SCHEDULER_TOKEN = '<Cloudflare Secretと同じ値>'
node .\scripts\schedule-post.mjs `
  --at '2026-08-03T20:30:00+09:00' `
  --bluesky-file .\posts\2026-08-03-bluesky.txt `
  --x-file .\posts\2026-08-03-x.txt
```

Workerは毎分、期限を過ぎた予約を実行する。同じ予約でBluesky投稿を二重に作らないよう、BlueskyのURIをD1へ先に記録してからDiscord通知を送る。
