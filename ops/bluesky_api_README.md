# Bluesky API 投稿準備

投稿スクリプトは `bluesky_api_post.mjs`。Bluesky のアプリパスワードはファイルに保存せず、実行時の環境変数だけで渡す。

## 原稿一覧

```powershell
node .\work\bluesky_api_post.mjs --list
```

## ドライラン

```powershell
node .\work\bluesky_api_post.mjs --file work/sns_dealshield.json --dry-run
```

コードフェンス内の文章を1投稿ずつ抽出する。DealShield と DealLog はスレッド原稿として扱える。

## 投稿時

Bluesky の設定画面でアプリパスワードを作成し、ユーザー自身のターミナルで一時的に環境変数へ設定する。

```powershell
$env:BLUESKY_HANDLE = "自分のハンドル"
$env:BLUESKY_APP_PASSWORD = "アプリパスワード"
node .\work\bluesky_api_post.mjs --file work/sns_dealshield.json --post --confirm
```

`--confirm` がない限り、投稿APIは呼び出さない。投稿成功後は `at://` URI が表示される。投稿前にドライランの内容を確認すること。
