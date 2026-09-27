# TechVault Portal - デザイントークン

> TechVault社ポータルの視覚的スタイル定義。
> 金融データ分析SaaS企業として「信頼感」「清潔感」を意識したコーポレートデザイン。

## カラーパレット

### Primary

| トークン | 値 | 用途 |
|---------|-----|------|
| `--tv-primary` | `#1a73e8` | プライマリアクション（ボタン・リンク） |
| `--tv-primary-hover` | `#1557b0` | プライマリ hover |
| `--tv-primary-light` | `#e8f0fe` | プライマリ背景（選択状態等） |

### Neutral

| トークン | 値 | 用途 |
|---------|-----|------|
| `--tv-bg-page` | `#f8f9fa` | ページ背景 |
| `--tv-bg-surface` | `#ffffff` | カード・モーダル背景 |
| `--tv-bg-sidebar` | `#202124` | サイドバー背景 |
| `--tv-text-primary` | `#202124` | 本文テキスト |
| `--tv-text-secondary` | `#5f6368` | 補助テキスト |
| `--tv-text-inverse` | `#ffffff` | ダーク背景上のテキスト |
| `--tv-border` | `#dadce0` | ボーダー・区切り線 |
| `--tv-divider` | `#e8eaed` | セクション区切り |

### Semantic

| トークン | 値 | 用途 |
|---------|-----|------|
| `--tv-success` | `#34a853` | 成功・正常 |
| `--tv-warning` | `#fbbc04` | 警告 |
| `--tv-error` | `#ea4335` | エラー・危険 |
| `--tv-info` | `#4285f4` | 情報 |

### Accent（ブランドカラー）

| トークン | 値 | 用途 |
|---------|-----|------|
| `--tv-accent-teal` | `#00897b` | ステータスバッジ・アクセント |
| `--tv-accent-purple` | `#7b1fa2` | AI関連UI要素 |

## タイポグラフィ

### フォントファミリー

| トークン | 値 | 用途 |
|---------|-----|------|
| `--tv-font-heading` | `'Inter', sans-serif` | 見出し |
| `--tv-font-body` | `'Inter', sans-serif` | 本文 |
| `--tv-font-code` | `'JetBrains Mono', monospace` | コード・技術表示 |

### フォントサイズ

| トークン | 値 | 用途 |
|---------|-----|------|
| `--tv-text-xs` | `12px` | キャプション・補助 |
| `--tv-text-sm` | `14px` | 本文（小） |
| `--tv-text-base` | `16px` | 本文（標準） |
| `--tv-text-lg` | `18px` | 小見出し |
| `--tv-text-xl` | `20px` | セクション見出し |
| `--tv-text-2xl` | `24px` | ページタイトル |
| `--tv-text-3xl` | `30px` | ヒーロータイトル |

### フォントウェイト

| トークン | 値 | 用途 |
|---------|-----|------|
| `--tv-font-normal` | `400` | 本文 |
| `--tv-font-medium` | `500` | 強調テキスト |
| `--tv-font-semibold` | `600` | 見出し・ボタン |
| `--tv-font-bold` | `700` | ページタイトル |

## スペーシング

| トークン | 値 |
|---------|-----|
| `--tv-space-1` | `4px` |
| `--tv-space-2` | `8px` |
| `--tv-space-3` | `12px` |
| `--tv-space-4` | `16px` |
| `--tv-space-5` | `20px` |
| `--tv-space-6` | `24px` |
| `--tv-space-8` | `32px` |
| `--tv-space-10` | `40px` |
| `--tv-space-12` | `48px` |

## ボーダー・シャドウ

| トークン | 値 | 用途 |
|---------|-----|------|
| `--tv-radius-sm` | `4px` | 小要素（バッジ・チップ） |
| `--tv-radius-md` | `8px` | カード・入力フィールド |
| `--tv-radius-lg` | `12px` | モーダル・大カード |
| `--tv-radius-full` | `9999px` | アバター・丸ボタン |
| `--tv-shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | 小要素 |
| `--tv-shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | カード |
| `--tv-shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | モーダル・ドロップダウン |

## ブレイクポイント

| トークン | 値 | 対象 |
|---------|-----|------|
| `--tv-bp-sm` | `640px` | モバイル |
| `--tv-bp-md` | `768px` | タブレット |
| `--tv-bp-lg` | `1024px` | デスクトップ（小） |
| `--tv-bp-xl` | `1280px` | デスクトップ（標準） |

## レイアウト定数

| トークン | 値 | 用途 |
|---------|-----|------|
| `--tv-sidebar-width` | `240px` | サイドバー幅 |
| `--tv-sidebar-collapsed` | `64px` | サイドバー折りたたみ時 |
| `--tv-topbar-height` | `56px` | トップバー高さ |
| `--tv-content-max-width` | `1200px` | コンテンツ最大幅 |

## z-index

| トークン | 値 | 用途 |
|---------|-----|------|
| `--tv-z-sidebar` | `100` | サイドバー |
| `--tv-z-topbar` | `200` | トップバー |
| `--tv-z-dropdown` | `300` | ドロップダウン |
| `--tv-z-modal` | `400` | モーダル |
| `--tv-z-toast` | `500` | トースト通知 |

## トランジション

| トークン | 値 | 用途 |
|---------|-----|------|
| `--tv-transition-fast` | `150ms ease` | hover・フォーカス |
| `--tv-transition-normal` | `250ms ease` | 展開・折りたたみ |
| `--tv-transition-slow` | `350ms ease` | ページ遷移・モーダル |

## デザイン意図メモ

- **Google Workspace風**: 企業SaaSとして馴染みのある配色
- **控えめなシャドウ**: フラットデザイン寄りだが浮遊感は軽く出す
- **Inter フォント統一**: 見出し・本文をInterで統一し、コードのみ等幅
- **ダークサイドバー**: 管理系ツールの定番パターン
- **CTFとの対比**: CTFプラットフォーム（ピクセル・8bit）と明確に区別
