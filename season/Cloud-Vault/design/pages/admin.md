# TechVault Portal - 管理パネル画面

> パス: `/admin`
> 認証: 必須（JWT + `custom:role === 'admin'`）
> CTFステージ: Stage 3C（Cognito カスタム属性乱用でアクセス）

## アクセス制御

### 通常状態（employee ロール）

サイドバーに Admin メニューが表示されない。
URLで直接 `/admin` にアクセスすると 403 画面を表示。

```
┌─────────────────────────────────┐
│                                 │
│           🔒                    │
│                                 │
│    Access Denied                │
│                                 │
│    You don't have permission    │
│    to view this page.           │
│                                 │
│    Contact your administrator   │
│    for access.                  │
│                                 │
│       [Back to Dashboard]       │
│                                 │
└─────────────────────────────────┘
```

### admin ロール取得後

Stage 3C で `custom:role` を `admin` に書き換えた参加者がアクセス可能。

## 画面レイアウト

```
┌────────┬───────────────────────────────────────────────┐
│        │ Topbar: Admin Panel                  🔔  👤   │
│ Side-  ├───────────────────────────────────────────────┤
│ bar    │                                               │
│        │  Admin Panel                                  │
│ 📊     │  System administration and management.        │
│ 💬     │                                               │
│ 📄     │  [Users] [Settings] [Logs]    ← タブ切り替え  │
│ ⚙️ *   │                                               │
│        │  ┌──────────────────────────────────────┐     │
│        │  │             Tab Content              │     │
│        │  │                                      │     │
│        │  │                                      │     │
│        │  └──────────────────────────────────────┘     │
│        │                                               │
└────────┴───────────────────────────────────────────────┘
```

## タブ 1: Users（ユーザー管理）

### レイアウト

```
┌──────────────────────────────────────────────┐
│ Users (48)                        [+ Add]    │
│                                              │
│ 🔍 Search users...                           │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Name      │ Email       │ Role   │ Stat │ │
│ ├──────────────────────────────────────────┤ │
│ │ 👤 John D │ john@tv.io  │ admin  │ ✅   │ │
│ │ 👤 Sarah  │ sarah@tv.io │ emp.   │ ✅   │ │
│ │ 👤 Mike   │ mike@tv.io  │ emp.   │ ⚠️   │ │
│ │ 👤 Alice  │ alice@tv.io │ emp.   │ ✅   │ │
│ │ 👤 Bob    │ bob@tv.io   │ emp.   │ ❌   │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

**カラム:**

| カラム | 幅 | 内容 |
|--------|-----|------|
| Name | flex | Avatar + フルネーム |
| Email | 200px | メールアドレス |
| Role | 100px | Badge（admin=info, employee=neutral） |
| Status | 80px | Badge（Active=success, Pending=warning, Disabled=error） |
| Actions | 60px | Dropdown（View / Edit / Disable） |

**モックユーザーデータ:**

| 名前 | メール | ロール | ステータス | 部署 |
|------|--------|--------|----------|------|
| John Davis | john.davis@techvault.io | admin | Active | Engineering |
| Sarah Chen | sarah.chen@techvault.io | employee | Active | Finance |
| Mike Wilson | mike.wilson@techvault.io | employee | Pending | Engineering |
| Alice Kim | alice.kim@techvault.io | employee | Active | HR |
| Bob Taylor | bob.taylor@techvault.io | employee | Disabled | Marketing |
| Emma Brown | emma.brown@techvault.io | employee | Active | Security |
| David Lee | david.lee@techvault.io | employee | Active | Engineering |
| Lisa Wang | lisa.wang@techvault.io | admin | Active | Engineering |

### ユーザー詳細モーダル

ユーザー行クリック or Actions > View で表示。

```
┌────────────────────────────────────────┐
│ User Details                     [×]   │
├────────────────────────────────────────┤
│                                        │
│  👤 John Davis                         │
│                                        │
│  Email:      john.davis@techvault.io   │
│  Role:       admin                     │
│  Department: Engineering               │
│  Status:     Active                    │
│  Created:    2023-06-15                │
│  Last Login: 2026-03-01 14:32          │
│                                        │
│  Cognito User ID:                      │
│  a1b2c3d4-e5f6-7890-abcd-ef1234567890 │
│                                        │
├────────────────────────────────────────┤
│                        [Close]         │
└────────────────────────────────────────┘
```

## タブ 2: Settings（システム設定）

### レイアウト

```
┌──────────────────────────────────────────────┐
│ System Settings                              │
│                                              │
│ ┌── Application ──────────────────────────┐  │
│ │ App Name:       TechVault Portal        │  │
│ │ Version:        2.1.4                   │  │
│ │ Environment:    production              │  │
│ │ Region:         ap-northeast-1          │  │
│ └─────────────────────────────────────────┘  │
│                                              │
│ ┌── Authentication ───────────────────────┐  │
│ │ Provider:       Amazon Cognito          │  │
│ │ User Pool ID:   ap-northeast-1_XXXXX   │  │  ← CTF手がかり
│ │ Client ID:      1a2b3c4d5e6f7g8h       │  │  ← CTF手がかり
│ │ Self-Signup:    Enabled ⚠️               │  │  ← 脆弱性の示唆
│ │ MFA:            Optional                │  │
│ └─────────────────────────────────────────┘  │
│                                              │
│ ┌── Storage ──────────────────────────────┐  │
│ │ Frontend:       techvault-portal-fe     │  │
│ │ Documents:      techvault-docs-prod     │  │
│ │ Logs:           techvault-cloudtrail    │  │  ← CTF手がかり
│ └─────────────────────────────────────────┘  │
│                                              │
│ ┌── AI Assistant ─────────────────────────┐  │
│ │ Provider:       Amazon Bedrock          │  │
│ │ Model:          Claude 3 Sonnet         │  │
│ │ Guardrails:     Not configured ⚠️        │  │  ← 脆弱性の示唆
│ │ S3 Vectors: techvault-vault-vectors     │  │  ← CTF手がかり
│ └─────────────────────────────────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

**設計意図:**
- 設定画面に表示される情報が次のステージへの手がかりとなる
- Cognito User Pool ID / Client ID → Stage 3C の攻撃に必要
- ⚠️ マークで「設定が甘い」ことを示唆

### 設定カードスタイル

- Card コンポーネント
- ラベル: `--tv-text-secondary`, `--tv-text-sm`
- 値: `--tv-text-primary`, `--tv-font-code`（技術的な値）
- ⚠️: `--tv-warning` カラー

## タブ 3: Logs（ログ）

### レイアウト

```
┌──────────────────────────────────────────────┐
│ System Logs                    [Refresh] 🔄  │
│                                              │
│ ┌─ Filter ────────────────────────────────┐  │
│ │ Level: [All ▾]  Date: [Last 24h ▾]     │  │
│ └─────────────────────────────────────────┘  │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Time       │ Level │ Message            │ │
│ ├──────────────────────────────────────────┤ │
│ │ 14:32:01   │ INFO  │ User login: john   │ │
│ │ 14:31:45   │ WARN  │ Rate limit near    │ │
│ │ 14:30:12   │ INFO  │ API call: /chat    │ │
│ │ 14:29:58   │ ERROR │ Auth failed: x@y   │ │
│ │ 14:28:03   │ INFO  │ Doc download: Q4   │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

**Level バッジ:**

| Level | Badge variant |
|-------|--------------|
| INFO | `info` |
| WARN | `warning` |
| ERROR | `error` |
| DEBUG | `neutral` |

**モックログデータ:**

| 時間 | Level | メッセージ |
|------|-------|----------|
| 14:32:01 | INFO | User login successful: john.davis@techvault.io |
| 14:31:45 | WARN | Rate limit approaching for /api/chat (28/30) |
| 14:30:12 | INFO | API call: POST /api/chat from user john.davis |
| 14:29:58 | ERROR | Authentication failed: unknown@example.com |
| 14:28:03 | INFO | Document download: Q4_2026_Financial_Report.xlsx |
| 14:25:30 | WARN | Self-signup attempt: newuser@external.com |
| 14:22:15 | INFO | User profile updated: sarah.chen@techvault.io |
| 14:20:00 | DEBUG | Health check passed: all services operational |
| 14:18:45 | ERROR | Lambda timeout: portal-fetch (30s exceeded) |
| 14:15:22 | INFO | Bedrock invocation: claude-3-sonnet, tokens: 1,234 |

**設計意図:**
- ログにサービス名・バケット名・ユーザー名が含まれ、間接的な手がかりに
- Lambda名、S3バケット名の断片を自然に露出

## CTF関連: Stage 3C の攻略フロー

```
1. Stage 1B で自分のロールが "employee" であることを確認
2. 何らかの方法で Cognito User Pool ID と Client ID を入手
   - /api/config エンドポイント（認証不要）
   - 管理画面の Settings タブ（admin取得後に確認可能）
3. AWS CLI で custom:role=admin を指定してセルフサインアップ
4. /api/auth/verify で確認済みにする
5. Cognito の IdToken を取得して /api/admin/flag にアクセス
6. フラグ取得
```

## レスポンシブ対応

| ブレイクポイント | レイアウト |
|----------------|----------|
| Desktop (>1024px) | タブ横並び、テーブルフル表示 |
| Tablet (768-1024px) | タブ横並び、一部カラム非表示 |
| Mobile (<768px) | タブを Dropdown に変更、カードレイアウト |
