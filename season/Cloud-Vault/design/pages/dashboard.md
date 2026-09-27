# TechVault Portal - ダッシュボード画面

> パス: `/dashboard`
> 認証: 必須（JWT）
> CTFステージ: 直接的な脆弱性なし（雰囲気づくり）

## 画面レイアウト

```
┌────────┬───────────────────────────────────────────────┐
│        │ Topbar: Dashboard                    🔔  👤   │
│ Side-  ├───────────────────────────────────────────────┤
│ bar    │                                               │
│        │  Welcome back, John 👋                        │
│ 📊 *   │  Here's what's happening at TechVault today.  │
│ 💬     │                                               │
│ 📄     │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐         │
│ ⚙️     │  │Active│ │ Team │ │Pend- │ │ Up-  │         │
│        │  │Proj. │ │ Mem. │ │ ing  │ │ time │         │
│        │  │  12  │ │  48  │ │   5  │ │99.8% │         │
│        │  └──────┘ └──────┘ └──────┘ └──────┘         │
│        │                                               │
│        │  Recent Activity            Announcements     │
│        │  ┌──────────────────┐  ┌──────────────────┐  │
│        │  │ • File uploaded  │  │ 🔧 System maint. │  │
│        │  │ • Comment added  │  │    Mar 15, 2026   │  │
│        │  │ • Status changed │  │                   │  │
│        │  │ • New member     │  │ 📢 Q1 All-hands  │  │
│        │  │ • ...            │  │    Mar 20, 2026   │  │
│        │  └──────────────────┘  └──────────────────┘  │
│        │                                               │
│        │  Quick Links                                  │
│        │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐    │
│        │  │ Docs  │ │ Chat  │ │ Tasks │ │ Help  │    │
│        │  └───────┘ └───────┘ └───────┘ └───────┘    │
│        │                                               │
└────────┴───────────────────────────────────────────────┘
```

## セクション詳細

### 1. ウェルカムメッセージ

```
Welcome back, {firstName} 👋
Here's what's happening at TechVault today.
```

- 名前: Cognito ユーザー属性の `given_name`
- テキスト: `--tv-text-2xl` / `--tv-font-bold`（名前部分）
- サブテキスト: `--tv-text-base` / `--tv-text-secondary`

### 2. KPI カード（StatCard x 4）

横並び4カード。モバイルでは2x2グリッド。

| カード | 値 | 変化率 | アイコン |
|--------|-----|-------|---------|
| Active Projects | 12 | +8% ↑ | 📊 |
| Team Members | 48 | +2 ↑ | 👥 |
| Pending Tasks | 5 | -3 ↓ | ⏳ |
| System Uptime | 99.8% | flat | ✅ |

**データ**: すべてハードコード（モック）。リアルなデータを返す必要なし。

**スタイル:**
- gap: `--tv-space-6` (24px)
- カード: `Card` コンポーネント
- 値: `--tv-text-3xl`, `--tv-font-bold`
- 変化率: Badge (`success` / `error`)

### 3. Recent Activity（最近のアクティビティ）

カード内にリスト表示。各アイテムにアイコン・タイムスタンプ。

| アクティビティ | タイムスタンプ |
|---------------|--------------|
| 📄 report_q4_2026.xlsx uploaded by Sarah | 2 hours ago |
| 💬 Comment on Project Alpha review | 4 hours ago |
| ✅ Task "Update IAM policy" marked done | Yesterday |
| 👤 New member: Mike joined Engineering | 2 days ago |
| 📊 Dashboard metrics refreshed | 3 days ago |

**スタイル:**
- リストアイテム: padding `--tv-space-3`, border-bottom `--tv-divider`
- タイムスタンプ: `--tv-text-xs`, `--tv-text-secondary`
- ホバー: bg `--tv-bg-page`

### 4. Announcements（お知らせ）

カード内に通知カード。

```
┌─────────────────────────┐
│ 🔧 Scheduled Maintenance│
│ March 15, 2026 02:00 AM │
│ Portal will be offline  │
│ for ~30 minutes.        │
├─────────────────────────┤
│ 📢 Q1 All-Hands Meeting │
│ March 20, 2026 10:00 AM │
│ Join the company-wide   │
│ quarterly review.       │
└─────────────────────────┘
```

**スタイル:**
- Alert コンポーネント（`info` / `warning`）を縦並び
- gap: `--tv-space-4`

### 5. Quick Links（クイックリンク）

カード型のリンク集。4つ横並び。

| リンク | アイコン | 遷移先 |
|--------|---------|--------|
| Documents | 📄 | /documents |
| AI Chat | 💬 | /chat |
| Tasks | ✅ | # (disabled) |
| Help Center | ❓ | # (disabled) |

**スタイル:**
- カード: border `--tv-border`, hover で shadow 増加
- アイコン: 32px, `--tv-primary`
- テキスト: `--tv-text-sm`, `--tv-font-medium`

## レスポンシブ対応

| ブレイクポイント | レイアウト |
|----------------|----------|
| Desktop (>1024px) | KPI 4列、Activity + Announcements 2列 |
| Tablet (768-1024px) | KPI 2列、Activity + Announcements 縦並び |
| Mobile (<768px) | KPI 2列、すべて縦並び、サイドバー非表示 |

## 設計意図

- **情報過多にしない**: 「ちょうどいいSaaS」感
- **直接的な手がかりなし**: ダッシュボードに脆弱性は埋め込まない
- **自然な導線**: Chat / Documents へのリンクで他ページへ誘導
- **企業感**: KPIカード・お知らせ・アクティビティログで「社内ツール」の雰囲気
