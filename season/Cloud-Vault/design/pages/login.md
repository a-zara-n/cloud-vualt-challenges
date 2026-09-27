# TechVault Portal - ログイン画面

> パス: `/`
> 認証: 不要
> CTFステージ: Stage 0（デバッグ情報漏洩）, T3（HTMLソース内の秘密）

## 画面レイアウト

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                    ┌─────────────────────┐                  │
│                    │                     │                  │
│                    │     TECHVAULT       │                  │
│                    │    ━━━━━━━━━━━━     │                  │
│                    │                     │                  │
│                    │  Email              │                  │
│                    │  ┌─────────────┐    │                  │
│                    │  │             │    │                  │
│                    │  └─────────────┘    │                  │
│                    │                     │                  │
│                    │  Password           │                  │
│                    │  ┌─────────────┐    │                  │
│                    │  │         👁   │    │                  │
│                    │  └─────────────┘    │                  │
│                    │                     │                  │
│                    │  ☐ Remember me      │                  │
│                    │                     │                  │
│                    │  ┌─────────────┐    │                  │
│                    │  │   Sign In   │    │                  │
│                    │  └─────────────┘    │                  │
│                    │                     │                  │
│                    │  Forgot password?   │                  │
│                    │  Don't have an      │                  │
│                    │  account? Sign up   │                  │
│                    │                     │                  │
│                    └─────────────────────┘                  │
│                                                             │
│                    © 2026 TechVault Inc.                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 画面構成

### 背景

- 単色: `--tv-bg-page` (`#f8f9fa`)
- またはグラデーション: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` の薄い版

### ログインカード

| 要素 | スタイル |
|------|---------|
| 幅 | `400px` (モバイル: `100% - 32px`) |
| 背景 | `--tv-bg-surface` |
| 角丸 | `--tv-radius-lg` (12px) |
| シャドウ | `--tv-shadow-lg` |
| パディング | `--tv-space-10` (40px) |

### ロゴ

- テキスト「TECHVAULT」: `--tv-font-heading`, `--tv-text-2xl`, `--tv-font-bold`
- カラー: `--tv-text-primary`
- 下にサブテキスト: 「Employee Portal」 `--tv-text-sm`, `--tv-text-secondary`

### 入力フィールド

| フィールド | 仕様 |
|-----------|------|
| Email | type: `email`, placeholder: `you@techvault.io`, required |
| Password | type: `password`, パスワード表示トグル付き, required |

### ボタン

| ボタン | スタイル |
|--------|---------|
| Sign In | Button `primary`, full-width, size `lg` |

### リンク

- 「Forgot password?」: `--tv-primary`, font-size `--tv-text-sm`
- 「Don't have an account? **Sign up**」: Sign upのみ `--tv-primary`

## インタラクション

### ログイン処理

```
1. [Sign In] クリック
2. バリデーション
   - Email: 空チェック、形式チェック
   - Password: 空チェック
3. POST /api/auth { email, password }
4. 成功 → localStorage に tokens 保存 → /dashboard へ遷移
5. 失敗 → エラーメッセージ表示
```

### エラー表示

```
┌──────────────────────────────────┐
│ ⚠️ Invalid email or password.   │
│ Please try again.                │
└──────────────────────────────────┘
```

- Alert コンポーネント (`variant: error`)
- カードの上部に表示
- ログイン失敗時、Password フィールドをクリア

### ローディング状態

- Sign In ボタン: Spinner + 「Signing in...」
- 入力フィールド: disabled

## CTF関連: 意図的な脆弱性

### Stage 0: DevToolsでのデバッグ情報確認

参加者がブラウザのDevToolsを開き、ログイン試行時の401レスポンスを確認すると：

```json
{
  "error": "Unauthorized",
  "debug": {
    "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
    "aws_secret_access_key": "wJalrXUtnFEMI/...",
    "region": "ap-northeast-1"
  }
}
```

**UIでの演出**: 特に目立つヒントは出さない。DevToolsのNetworkタブを見る基本スキルを問う。

### T3: HTMLソース内の秘密

HTMLソースに残された開発用コメント：

```html
<!-- TODO: remove debug marker before release: TVAULT{hardcoded_secret_in_js} -->
```

## レスポンシブ対応

| ブレイクポイント | レイアウト |
|----------------|----------|
| Desktop (>768px) | カード中央配置、400px幅 |
| Mobile (<768px) | カードフル幅（左右16pxマージン）、パディング24px |

## フッター

```
© 2026 TechVault Inc. All rights reserved.
```

- `--tv-text-secondary`, `--tv-text-xs`
- カード下、中央配置
