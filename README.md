# webapp-maker

「WEBアプリを作る人」がつくった道具たち。
正解より、判断の順番で。

## 入っているもの

| パス | 中身 | 公開先 |
|---|---|---|
| `invoiceflow/` | 適格請求書ジェネレーター + つくったもの一覧 (works) | https://invoiceflow-8qd.pages.dev |
| `truerate/` | 実質時給シミュレーター | https://truerate.pages.dev |
| `tekicheck/` | 適格請求書チェッカー | https://tekicheck.pages.dev |
| `ops/` | 運用メモ・SNS下書き・ブランド画像 | — |

## デプロイ

各アプリは Cloudflare Pages（静的）。リポジトリのルートから:

```
npx wrangler pages deploy invoiceflow --project-name invoiceflow --commit-dirty=true
npx wrangler pages deploy truerate    --project-name truerate    --commit-dirty=true
npx wrangler pages deploy tekicheck   --project-name tekicheck   --commit-dirty=true
```

## 判断メモ

各アプリの「なぜその順で判断したか」は works ページに1行ずつ添えている。
https://invoiceflow-8qd.pages.dev/works

---
© 2026 — 判断の順番
