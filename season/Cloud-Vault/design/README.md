# TechVault Portal - 設計ドキュメント

> TechVault社の社内ポータルサイトの設計ドキュメント。
> CTF参加者が実際に操作・調査する対象アプリケーション。

## ドキュメント一覧

| ファイル | 内容 |
|---------|------|
| [design-tokens.md](./design-tokens.md) | デザイントークン（カラー・タイポグラフィ・スペーシング等） |
| [components.md](./components.md) | 共通UIコンポーネント設計 |
| [features.md](./features.md) | 機能設計（認証・API・データフロー） |
| [pages/login.md](./pages/login.md) | ログイン画面 |
| [pages/dashboard.md](./pages/dashboard.md) | 従業員ダッシュボード |
| [pages/chat.md](./pages/chat.md) | AI アシスタントチャット |
| [pages/documents.md](./pages/documents.md) | ドキュメント一覧 |
| [pages/admin.md](./pages/admin.md) | 管理パネル |

## 設計方針

### アプリの性格

TechVaultポータルは**架空の企業向けSaaS内部ツール**であり、以下の印象を与える設計とする。

- **リアルな企業ポータル**: 「ありそうな社内システム」の雰囲気
- **やや雑な実装**: スタートアップの「動けばOK」文化を反映
- **隠された手がかり**: CTF参加者が発見すべき脆弱性を自然に埋め込む

### CTFプラットフォームとの区別

| 項目 | CTFプラットフォーム (Cloud Fortress) | TechVault Portal |
|------|--------------------------------------|------------------|
| 目的 | CTF運営・スコア管理 | CTF攻略対象 |
| デザイン | 8bitピクセルアート風 | 企業SaaS風（モダン） |
| フォント | Press Start 2P | Inter / SF Pro |
| 角丸 | なし（border-radius: 0） | あり（標準的） |
| 対象者 | CTF参加者（プレイヤー視点） | TechVault従業員（ロールプレイ） |

### 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React SPA（S3 + CloudFront） |
| API | API Gateway + Lambda (Node.js 20.x) |
| 認証 | Amazon Cognito（User Pool + Identity Pool） |
| AI | Amazon Bedrock（Claude 3 Sonnet） |
| 内部サーバー | EC2 (Flask / Python) |
| DB | RDS PostgreSQL |

### ページ構成

```
/ .................. ログイン画面
/dashboard ......... 従業員ダッシュボード
/chat .............. AI アシスタント
/documents ......... ドキュメント一覧
/admin ............. 管理パネル（admin ロールのみ）
```
