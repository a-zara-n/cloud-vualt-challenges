# TechVault Portal - ドキュメント一覧画面

> パス: `/documents`
> 認証: 必須（JWT）
> CTFステージ: 直接的な脆弱性なし（S3の存在を示唆する伏線）

## 画面レイアウト

```
┌────────┬───────────────────────────────────────────────┐
│        │ Topbar: Documents                    🔔  👤   │
│ Side-  ├───────────────────────────────────────────────┤
│ bar    │                                               │
│        │  Documents                                    │
│ 📊     │  Browse and manage company documents.         │
│ 💬     │                                               │
│ 📄 *   │  ┌──────────────────────────────────────┐     │
│ ⚙️     │  │ 🔍 Search documents...    [Category▾]│     │
│        │  └──────────────────────────────────────┘     │
│        │                                               │
│        │  ┌──────────────────────────────────────┐     │
│        │  │ Name          │ Cat.  │ Date   │Size │     │
│        │  ├──────────────────────────────────────┤     │
│        │  │📄 Q4 Report   │ Fin.  │ Mar 1  │2.1M│     │
│        │  │📄 Onboarding  │ HR    │ Feb 28 │890K│     │
│        │  │📄 API Docs    │ Eng.  │ Feb 25 │1.5M│     │
│        │  │📄 Security P. │ Sec.  │ Feb 20 │420K│     │
│        │  │📄 Brand Guide │ Mkt.  │ Feb 15 │3.2M│     │
│        │  │📄 Infra Arch. │ Eng.  │ Feb 10 │1.8M│     │
│        │  ├──────────────────────────────────────┤     │
│        │  │ ← 1 2 3 ... →                       │     │
│        │  └──────────────────────────────────────┘     │
│        │                                               │
└────────┴───────────────────────────────────────────────┘
```

## セクション詳細

### ページヘッダー

```
Documents
Browse and manage company documents.
```

- タイトル: `--tv-text-2xl`, `--tv-font-bold`
- サブテキスト: `--tv-text-base`, `--tv-text-secondary`

### フィルターバー

```
┌──────────────────────────────────────────────┐
│ 🔍 Search documents...         [Category ▾]  │
└──────────────────────────────────────────────┘
```

- 検索: Input コンポーネント、検索アイコン付き
- カテゴリ: Select コンポーネント
  - All Categories
  - Engineering
  - HR
  - Finance
  - Security
  - Marketing

### ドキュメントテーブル

DataTable コンポーネントを使用。

**カラム定義:**

| カラム | 幅 | ソート | 内容 |
|--------|-----|------|------|
| Name | flex | ✅ | ファイルアイコン + ファイル名 |
| Category | 120px | ✅ | Badge（カテゴリ別色） |
| Last Modified | 140px | ✅ | 相対日時（"2 days ago"） |
| Size | 80px | ✅ | ファイルサイズ |
| Actions | 80px | - | ダウンロード / プレビュー |

**カテゴリバッジ色:**

| カテゴリ | Badge variant |
|---------|--------------|
| Engineering | `info` |
| HR | `success` |
| Finance | `warning` |
| Security | `error` |
| Marketing | `neutral` |

### モックデータ

| ファイル名 | カテゴリ | 日付 | サイズ |
|-----------|---------|------|--------|
| Q4_2026_Financial_Report.xlsx | Finance | 2026-03-01 | 2.1 MB |
| Employee_Onboarding_Guide.pdf | HR | 2026-02-28 | 890 KB |
| API_Documentation_v3.pdf | Engineering | 2026-02-25 | 1.5 MB |
| Security_Policy_2026.pdf | Security | 2026-02-20 | 420 KB |
| Brand_Guidelines_v2.pdf | Marketing | 2026-02-15 | 3.2 MB |
| Infrastructure_Architecture.pdf | Engineering | 2026-02-10 | 1.8 MB |
| PTO_Request_Form.docx | HR | 2026-02-05 | 125 KB |
| Incident_Response_Plan.pdf | Security | 2026-01-30 | 680 KB |
| Monthly_KPI_Dashboard.xlsx | Finance | 2026-01-25 | 1.1 MB |
| Cloud_Migration_Roadmap.pdf | Engineering | 2026-01-20 | 2.4 MB |

### アクション

| アクション | アイコン | 動作 |
|-----------|---------|------|
| Download | ⬇️ | S3 Presigned URL でダウンロード |
| Preview | 👁️ | モーダルでプレビュー表示 |

### ページネーション

- 1ページ10件
- `← 1 2 3 ... →` 形式
- 現在ページ: `--tv-primary` 背景

## プレビューモーダル

```
┌─────────────────────────────────────┐
│ Q4_2026_Financial_Report.xlsx  [×]  │
├─────────────────────────────────────┤
│                                     │
│  [Document Preview Area]            │
│                                     │
│  Preview not available for          │
│  this file type.                    │
│                                     │
├─────────────────────────────────────┤
│                      [Download]     │
└─────────────────────────────────────┘
```

- Modal コンポーネント（size: `lg`）
- PDFのみインラインプレビュー対応
- その他: 「Preview not available」+ ダウンロードボタン

## EmptyState

検索結果なしの場合:

```
        📄

  No documents found

  Try adjusting your search
  or filter criteria.

     [Clear Filters]
```

## 設計意図

- **S3の伏線**: ドキュメントがS3から配信されていることを自然に示唆
- **リアルな社内ツール**: ファイル管理はどの企業にもあるUI
- **直接的な脆弱性なし**: この画面自体は安全に動作する
- **モックデータで十分**: 実際のファイルをホストする必要はなく、テーブル表示のみ

## レスポンシブ対応

| ブレイクポイント | レイアウト |
|----------------|----------|
| Desktop (>1024px) | フルテーブル表示 |
| Tablet (768-1024px) | Size列非表示 |
| Mobile (<768px) | カードリスト表示に切り替え |

### モバイルカードレイアウト

```
┌────────────────────────────────┐
│ 📄 Q4_2026_Financial_Report   │
│    Finance  •  2.1 MB         │
│    Mar 1, 2026       [⬇️] [👁️]│
└────────────────────────────────┘
```
