# TechVault Portal - 共通コンポーネント設計

> TechVaultポータル全画面で使用する共通UIコンポーネントの仕様。

## コンポーネント一覧

```
components/
├── layout/
│   ├── AppShell          # サイドバー + トップバー + メインコンテンツ
│   ├── Sidebar           # ナビゲーションサイドバー
│   ├── Topbar            # 上部ツールバー
│   └── PageContainer     # ページコンテンツラッパー
├── navigation/
│   ├── NavItem           # サイドバーのナビリンク
│   ├── Breadcrumb        # パンくずリスト
│   └── UserMenu          # ユーザードロップダウン
├── data-display/
│   ├── Card              # 汎用カード
│   ├── StatCard          # KPIカード（数値表示）
│   ├── DataTable         # テーブル
│   ├── Badge             # ステータスバッジ
│   ├── Avatar            # ユーザーアバター
│   └── EmptyState        # データなし表示
├── feedback/
│   ├── Toast             # トースト通知
│   ├── Alert             # インラインアラート
│   ├── Spinner           # ローディング
│   └── Skeleton          # スケルトンローダー
├── form/
│   ├── Input             # テキスト入力
│   ├── Button            # ボタン
│   ├── Select            # セレクトボックス
│   ├── Checkbox          # チェックボックス
│   └── FormField         # ラベル + 入力 + エラーメッセージ
└── overlay/
    ├── Modal             # モーダルダイアログ
    ├── Dropdown          # ドロップダウンメニュー
    └── Tooltip           # ツールチップ
```

---

## Layout コンポーネント

### AppShell

アプリ全体のレイアウトフレーム。サイドバー・トップバー・メインコンテンツ領域を提供。

```
┌──────────────────────────────────────────────┐
│ Topbar (56px)                          [👤]  │
├────────┬─────────────────────────────────────┤
│        │                                     │
│ Side-  │  Main Content                       │
│ bar    │  (PageContainer)                    │
│ 240px  │                                     │
│        │                                     │
│  📊    │                                     │
│  💬    │                                     │
│  📄    │                                     │
│  ⚙️    │                                     │
│        │                                     │
└────────┴─────────────────────────────────────┘
```

**Props:**

| Prop | 型 | 説明 |
|------|-----|------|
| `children` | `ReactNode` | メインコンテンツ |
| `sidebarCollapsed` | `boolean` | サイドバー折りたたみ状態 |

**スタイル:**
- サイドバー: `bg: --tv-bg-sidebar`（ダーク）
- トップバー: `bg: --tv-bg-surface`, `border-bottom: 1px solid --tv-border`
- メインコンテンツ: `bg: --tv-bg-page`, `padding: --tv-space-8`

### Sidebar

左サイドバー。ロゴ・ナビゲーション・ユーザー情報を配置。

**構成:**

```
┌──────────┐
│ TECHVAULT│  ← ロゴ（テキスト）
│          │
│ ──────── │  ← divider
│          │
│ 📊 Dash  │  ← NavItem (active)
│ 💬 Chat  │  ← NavItem
│ 📄 Docs  │  ← NavItem
│          │
│ ──────── │
│          │
│ ⚙️ Admin │  ← NavItem (admin only)
│          │
│          │
│ ──────── │
│ 👤 User  │  ← ユーザー名 + ロール
└──────────┘
```

**スタイル:**
- 背景: `--tv-bg-sidebar` (`#202124`)
- テキスト: `--tv-text-inverse` (`#ffffff`)
- active NavItem: `bg: rgba(255,255,255,0.1)`, 左ボーダー `--tv-primary`
- hover: `bg: rgba(255,255,255,0.05)`

### Topbar

上部ツールバー。ページタイトル・検索・通知・ユーザーメニューを配置。

```
┌────────────────────────────────────────────────┐
│  ☰  Dashboard          🔍 Search...    🔔  👤  │
└────────────────────────────────────────────────┘
```

**構成:**
- 左: ハンバーガー（モバイル）+ ページタイトル
- 中央: 検索バー（オプション）
- 右: 通知アイコン + UserMenu

---

## Navigation コンポーネント

### NavItem

サイドバーのナビゲーションリンク。

**Props:**

| Prop | 型 | 説明 |
|------|-----|------|
| `icon` | `ReactNode` | アイコン |
| `label` | `string` | ラベルテキスト |
| `href` | `string` | リンク先 |
| `active` | `boolean` | アクティブ状態 |
| `badge` | `number?` | 通知バッジ（数値） |

**状態:**
- `default`: テキスト `rgba(255,255,255,0.7)`
- `hover`: 背景 `rgba(255,255,255,0.05)`
- `active`: 背景 `rgba(255,255,255,0.1)` + 左ボーダー 3px `--tv-primary`

### UserMenu

ユーザーアバター + ドロップダウン。

**メニュー項目:**
- Profile（プロフィール）
- Settings（設定）
- ---
- Sign out（ログアウト）

---

## Data Display コンポーネント

### Card

汎用カードコンテナ。

**Props:**

| Prop | 型 | 説明 |
|------|-----|------|
| `title` | `string?` | カードタイトル |
| `subtitle` | `string?` | サブタイトル |
| `children` | `ReactNode` | カード内容 |
| `actions` | `ReactNode?` | 右上アクション |
| `padding` | `'sm' \| 'md' \| 'lg'` | パディング |

**スタイル:**
- 背景: `--tv-bg-surface`
- ボーダー: `1px solid --tv-border`
- 角丸: `--tv-radius-md` (8px)
- シャドウ: `--tv-shadow-sm`

### StatCard

KPI数値表示カード。ダッシュボードで使用。

```
┌─────────────────────┐
│ Total Users    ↑12% │
│                     │
│     1,234           │
│                     │
│ ▁▂▃▅▆▇█▆▅▇         │
└─────────────────────┘
```

**Props:**

| Prop | 型 | 説明 |
|------|-----|------|
| `label` | `string` | メトリクス名 |
| `value` | `string \| number` | 表示値 |
| `change` | `number?` | 変化率（%） |
| `trend` | `'up' \| 'down' \| 'flat'` | トレンド方向 |
| `sparkline` | `number[]?` | ミニチャートデータ |

**トレンド色:**
- `up`: `--tv-success` (緑)
- `down`: `--tv-error` (赤)
- `flat`: `--tv-text-secondary` (グレー)

### DataTable

データテーブル。ソート・ページネーション付き。

**Props:**

| Prop | 型 | 説明 |
|------|-----|------|
| `columns` | `Column[]` | カラム定義 |
| `data` | `Row[]` | 行データ |
| `sortable` | `boolean` | ソート可否 |
| `pagination` | `boolean` | ページネーション有無 |
| `pageSize` | `number` | 1ページあたりの行数 |

**スタイル:**
- ヘッダー行: `bg: --tv-bg-page`, `font-weight: --tv-font-semibold`
- 行 hover: `bg: --tv-primary-light`
- ボーダー: `border-bottom: 1px solid --tv-divider`

### Badge

ステータスバッジ。

**バリエーション:**

| Variant | 背景 | テキスト | 用途 |
|---------|------|---------|------|
| `success` | `#e6f4ea` | `--tv-success` | Active, Approved |
| `warning` | `#fef7e0` | `#e37400` | Pending, Review |
| `error` | `#fce8e6` | `--tv-error` | Failed, Denied |
| `info` | `#e8f0fe` | `--tv-primary` | New, Info |
| `neutral` | `#f1f3f4` | `--tv-text-secondary` | Draft, Default |

**スタイル:**
- padding: `2px 8px`
- border-radius: `--tv-radius-sm` (4px)
- font-size: `--tv-text-xs` (12px)
- font-weight: `--tv-font-medium`

### Avatar

ユーザーアバター（イニシャル表示）。

**サイズ:**
- `sm`: 32px
- `md`: 40px
- `lg`: 56px

**スタイル:**
- 背景: ユーザー名からハッシュ生成した色
- テキスト: 白、イニシャル2文字
- border-radius: `--tv-radius-full`

---

## Feedback コンポーネント

### Toast

画面右上に表示されるトースト通知。

**バリエーション:**
- `success`: 左ボーダー `--tv-success`
- `error`: 左ボーダー `--tv-error`
- `warning`: 左ボーダー `--tv-warning`
- `info`: 左ボーダー `--tv-info`

**動作:**
- 右上から slide-in
- 5秒後に自動消去（hover で一時停止）
- 手動閉じボタンあり

### Alert

インラインアラート。ページ内に表示。

```
┌──────────────────────────────────────────┐
│ ⚠️  Your session will expire in 5 min.  │
│     Please save your work.         [×]  │
└──────────────────────────────────────────┘
```

**Props:**

| Prop | 型 | 説明 |
|------|-----|------|
| `variant` | `'success' \| 'warning' \| 'error' \| 'info'` | タイプ |
| `title` | `string?` | タイトル |
| `message` | `string` | メッセージ |
| `dismissible` | `boolean` | 閉じボタン表示 |

### Spinner / Skeleton

- **Spinner**: `--tv-primary` カラーの回転アニメーション。ボタン内・ページ中央に使用
- **Skeleton**: `--tv-divider` のパルスアニメーション。カード・テーブル読み込み時に使用

---

## Form コンポーネント

### Input

テキスト入力フィールド。

**状態:**
- `default`: border `--tv-border`
- `focus`: border `--tv-primary`, ring `--tv-primary-light`
- `error`: border `--tv-error`
- `disabled`: bg `--tv-bg-page`, opacity 0.5

**スタイル:**
- height: `40px`
- padding: `0 12px`
- border-radius: `--tv-radius-md`
- font-size: `--tv-text-sm`

### Button

ボタン。

**バリエーション:**

| Variant | 背景 | テキスト | ボーダー |
|---------|------|---------|---------|
| `primary` | `--tv-primary` | 白 | なし |
| `secondary` | 透明 | `--tv-primary` | `--tv-primary` |
| `ghost` | 透明 | `--tv-text-secondary` | なし |
| `danger` | `--tv-error` | 白 | なし |

**サイズ:**
- `sm`: height 32px, font 12px
- `md`: height 40px, font 14px
- `lg`: height 48px, font 16px

**状態:**
- `hover`: 背景色を10%暗く
- `active`: 背景色を20%暗く
- `disabled`: opacity 0.5, cursor not-allowed
- `loading`: Spinner + テキスト非表示

### FormField

ラベル + 入力 + ヘルプテキスト/エラーメッセージをまとめたラッパー。

```
Label *
┌──────────────────────┐
│ Placeholder text     │
└──────────────────────┘
Helper text or error message
```

---

## Overlay コンポーネント

### Modal

モーダルダイアログ。

```
┌─────────────────────────────┐
│ Modal Title            [×]  │
├─────────────────────────────┤
│                             │
│  Content area               │
│                             │
├─────────────────────────────┤
│            [Cancel] [Save]  │
└─────────────────────────────┘
```

**Props:**

| Prop | 型 | 説明 |
|------|-----|------|
| `title` | `string` | タイトル |
| `children` | `ReactNode` | 内容 |
| `open` | `boolean` | 表示状態 |
| `onClose` | `() => void` | 閉じるハンドラ |
| `size` | `'sm' \| 'md' \| 'lg'` | 幅 |

**サイズ:**
- `sm`: max-width 400px
- `md`: max-width 560px
- `lg`: max-width 720px

**スタイル:**
- 背景: `--tv-bg-surface`
- オーバーレイ: `rgba(0,0,0,0.5)`
- 角丸: `--tv-radius-lg`
- シャドウ: `--tv-shadow-lg`

### Dropdown

ドロップダウンメニュー。UserMenu・テーブルのアクション等で使用。

**スタイル:**
- 背景: `--tv-bg-surface`
- ボーダー: `1px solid --tv-border`
- シャドウ: `--tv-shadow-lg`
- 角丸: `--tv-radius-md`
- アイテム hover: `bg: --tv-bg-page`
