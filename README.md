# Web App Maker

小さな業務課題を、すぐ使えるWebツールとして形にするプロジェクト集です。

## Portfolio

| Project | What it does | Demo |
|---|---|---|
| `invoiceflow/` | 適格請求書ジェネレーター / 制作物一覧 | https://invoiceflow-8qd.pages.dev |
| `truerate/` | 実質時給シミュレーター | https://truerate.pages.dev |
| `tekicheck/` | 適格請求書チェッカー | https://tekicheck.pages.dev |

## What this repository demonstrates

- 要件を小さく切り出し、実用最小単位まで落とし込む設計
- 静的Webアプリの企画・実装・改善
- Cloudflare Pagesを使った軽量デプロイ
- 生成AI/Codexを含む開発ワークフローの活用
- 実装だけでなく、公開後の改善・運用まで含めたプロダクト設計

## Deployment

各アプリはCloudflare Pagesで公開しています。リポジトリのルートから以下でデプロイできます。

```bash
npx wrangler pages deploy invoiceflow --project-name invoiceflow --commit-dirty=true
npx wrangler pages deploy truerate    --project-name truerate    --commit-dirty=true
npx wrangler pages deploy tekicheck   --project-name tekicheck   --commit-dirty=true
```

## Notes

このリポジトリには複数の小規模Webアプリと開発・運用用ファイルが含まれます。公開ポートフォリオとして見る場合は、上記3プロジェクトを代表作として参照してください。
