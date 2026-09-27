# Cloud Vault — Season 1

セキュリティ初心者・AWS入門者向けのシナリオベースCTF。
**Cloud Fortless** Season 1 の舞台は **Cloud Vault**。

## ターゲット層

- セキュリティに全く触れたことがない完全初心者
- AWSを少し触ったことがある（CLIを使えるレベル）
- Webのネットワーク通信を Dev Console で確認できるレベル

## ゴール

架空企業 **TechVault社** のWebサービスを調査し、内部告発者が隠した「CEOの不正取引の証拠ファイル」を入手せよ。

---

## 問題ツリー（全体）

```
[START]
  │
  ├─[T1] Webの偵察       ─── [T2] 公開S3      ─── [T3] HTMLソース
  │  robots.txt ★☆           URLアクセス ★☆       ページソース ★☆
  │  ブラウザのみ              ブラウザのみ            ブラウザのみ
  │                                                       │
  │                                    ┌──────────────────┘
  │                                    ▼
  │                          [T4] curl入門 ★★ ─── [T5] .env漏洩 ★★
  │                           ヘッダー確認              設定ファイル
  │                                                       │
  │                                                       ▼
  │                                              [T6] AWS CLI基礎 ★★
  │                                               configure + STS
  │                                                       │
  └──────────────────────────────────┬────────────────────┘
                                     ▼
                              [Stage 0] ★☆
                          Dev ConsoleでAPIを観察
                          → AWSクレデンシャル漏洩
                                     │
              ┌──────────┬───────────┼───────────┐
              ▼          ▼           ▼           ▼
         [Stage 1A]  [Stage 1B]  [Stage 1C]  [Stage 1D]
         S3探索 ★★   身元確認 ★★  Git履歴 ★★  AI Inject ★★
              │           │           │
              ▼      ┌────┴──────┐    ▼
         [Stage 2A]  [Stage 2B]  [Stage 3C]★★★★  [Stage 2F]★★★
         S3バージョン IAMポリシー  Cognito bypass   secret scan
         ニング ★★★  読解 ★★★    (上級ルート)      (bonus)
              │           │
              │    ┌───────┼─────────────┐
              │    ▼       ▼             ▼
              │ [Stage 2C] [Stage 2D]  [Stage 2G] ★★★
              │ EC2タグ ★★★ Lambda ★★★  Bedrock Agent
              │ (bonus)        │             │
              │    │           ▼             ▼
              │    │       [Stage 2E]   [Stage 3E] ★★★★
              │    │       SSM ★★★      S3 Vectors
              │    │           │         (上級ルート)
              │    ▼           ▼
              │ [Stage 3B]  [Stage 3D]
              │ SSRF ★★★★★  ECR ★★★★★
              │ (bonus)     (bonus)
              │
              └──────────────────────────────┐
                       （2A + 2B クリアで解放）
                                             ▼
                                      [Stage 3A] ★★★★
                                  AssumeRole + Secrets Manager
                                             │
                                             ▼
                                        [FINAL] ★★★★
                                       証拠ファイル復号
                                             │
                                             ▼
                                       [Stage 4] ★★★★
                                    CloudTrail分析（Blue Team）
                                             │
                                             ▼
                                       [Stage 5] ★★★★★
                                       不審な動き（グランドフィナーレ）
                                       全情報統合・不審な操作の追跡
```

---

## 問題解放条件

| クリア条件          | 解放される問題                              |
|--------------------|------------------------------------------|
| 開始               | T1, T2, T3（同時解放）                    |
| T3 クリア          | T4                                       |
| T4 クリア          | T5                                       |
| T5 クリア          | T6                                       |
| T6 クリア or 開始  | Stage 0（並行して解放）                   |
| Stage 0            | Stage 1A, Stage 1B, Stage 1C, Stage 1D   |
| Stage 1A           | Stage 2A                                 |
| Stage 1B           | Stage 2B, Stage 3C（上級）               |
| Stage 1C           | Stage 2F（bonus）                        |
| Stage 2B           | Stage 2C, Stage 2D, Stage 2G             |
| Stage 2A + 2B      | Stage 3A                                 |
| Stage 2C           | Stage 3B（bonus）                        |
| Stage 2D           | Stage 2E                                 |
| Stage 2E           | Stage 3D（bonus）                        |
| Stage 2G           | Stage 3E（上級）                         |
| Stage 3A           | Final Stage                              |
| Final Stage        | Stage 4（Blue Team）                     |
| Stage 4            | Stage 5（グランドフィナーレ）             |

---

## 全問題一覧

### チュートリアルライン（ブラウザ → curl → AWS CLI）

| ID | タイトル | 難易度 | 配点 | ツール |
|----|--------|--------|------|--------|
| T1 | Webの偵察・robots.txt | ★☆☆☆☆ | 30+10pt | ブラウザのみ |
| T2 | 公開S3バケット | ★☆☆☆☆ | 30+10pt | ブラウザのみ |
| T3 | HTMLソースコメントの秘密 | ★☆☆☆☆ | 30+10pt | ブラウザのみ |
| T4 | curl入門・ヘッダーを読む | ★★☆☆☆ | 50+10pt | curl |
| T5 | .env ファイル漏洩 | ★★☆☆☆ | 75+10pt | curl |
| T6 | AWS CLI基礎・自分が誰かを知る | ★★☆☆☆ | 75+10pt | AWS CLI |

### メインライン（シナリオ進行）

| ID | タイトル | 難易度 | 配点 |
|----|--------|--------|------|
| Stage 0  | 消し忘れたデバッグ（Dev Console） | ★☆☆☆☆ | 50pt |
| Stage 1A | バケツをひっくり返せ（S3探索） | ★★☆☆☆ | 100pt |
| Stage 1B | 俺は誰だ（IAM身元確認） | ★★☆☆☆ | 100pt |
| Stage 1C | 消えない過去（Gitコミット履歴） | ★★☆☆☆ | 100pt |
| Stage 1D | AIに聞いてみた（Prompt Injection） | ★★☆☆☆ | 150pt |
| Stage 2A | 消えたファイル（S3バージョニング） | ★★★☆☆ | 200pt |
| Stage 2B | 権限の地図（IAMポリシー読解） | ★★★☆☆ | 200pt |
| Stage 2D | 関数の秘密（Lambda環境変数） | ★★★☆☆ | 200pt |
| Stage 2E | パラメータの迷宮（SSM） | ★★★☆☆ | 200pt |
| Stage 2G | AIの権限（Bedrock Agent権限ミス） | ★★★☆☆ | 200pt |
| Stage 3A | 金庫の鍵（AssumeRole + SM） | ★★★★☆ | 300pt |
| Final    | 証拠の統合（ファイル復号） | ★★★★☆ | 500pt |

### ボーナス・上級ライン

| ID | タイトル | 難易度 | 配点 | 区分 |
|----|--------|--------|------|------|
| Stage 2C | サーバーの影（EC2タグ） | ★★★☆☆ | 150pt | bonus |
| Stage 2F | 自動で見つける | ★★★☆☆ | 150pt | bonus |
| Stage 3B | 見えない声（SSRF+IMDS） | ★★★★★ | 400pt | bonus |
| Stage 3C | 偽の顔（Cognito bypass） | ★★★★☆ | 350pt | 上級 |
| Stage 3D | イメージの中の真実（ECR） | ★★★★★ | 500pt | bonus |
| Stage 3E | 隣の金庫（S3 Vectors） | ★★★★☆ | 350pt | 上級 |
| Stage 4  | 痕跡を追え（CloudTrail） | ★★★★☆ | 300pt | Blue Team |
| Stage 5  | 不審な動き（全情報統合） | ★★★★★ | 600pt | グランドフィナーレ（4必須、3B/3C/3D+3Eで別解） |
| Stage 5B | 全攻撃面の統合（ボーナス） | ★★★★★ | 200pt | bonus（3D+3E必須） |

### 合計配点

| 区分 | 問題数 | 配点 |
|------|--------|------|
| チュートリアル（T1〜T6 + クイズ） | 12問 | 350pt |
| メインライン | 12問 | 2,300pt |
| ボーナス・上級 | 7問 | 2,100pt |
| Blue Team | 1問 | 300pt |
| グランドフィナーレ | 1問 | 600pt |
| **総合計** | **33問** | **5,650pt** |

---

## スコアリング・運営方針

### 配点設計の考え方

- 難易度に比例して配点を上げる
- ボーナス問題（Stage 3B）は高配点だが必須ではない
- ヒント使用でペナルティを課してスキルのある参加者を評価

### ヒントシステム

| ヒントレベル | ペナルティ | 内容の目安 |
|-------------|-----------|-----------|
| ヒント1 | 0pt（無料） | 使うべきAWSサービスやツールの名前 |
| ヒント2 | -10〜20pt | 具体的なコマンド名 |
| ヒント3 | -20〜30pt | ほぼ答えに近い手順 |

### 順位決定方法

1. 獲得ポイントの合計（降順）
2. 同点の場合はフラグ提出時刻（昇順）

### チーム構成

- 1〜3人を推奨
- 4人以上の場合は審判裁量で別枠扱い

### 想定所要時間

| 参加者レベル | 所要時間の目安 |
|-------------|---------------|
| AWS初心者 | 3〜4時間（ヒントあり） |
| AWS経験者 | 1〜2時間 |
| セキュリティ経験者 | 30〜60分 |

### 問題解放のタイミング

- CTFd の Challenge Prerequisite 機能を使って管理
- 前提問題をクリアしないと問題文が見えない設定にする

### 運営側の事前準備チェックリスト

- [ ] AWSアカウントを CTF 専用に分離
- [ ] 参加者全員で共通クレデンシャルを使うか、チームごとに分けるか決定
- [ ] 各 Stage のフラグと仕掛けをデプロイ・動作確認
- [ ] Webアプリ（Stage 0, 3B）のデプロイ確認
- [ ] CTFd のセットアップと問題インポート
- [ ] ヒントの内容と価格設定
- [ ] 終了後のAWSリソース削除計画

---

## インフラ概要

### 実装状況

CDK スタック全10個を `apps/infra/lib/` に実装済み。`apps/infra/bin/app.ts` から一括デプロイ可能。

### AWS構成（CDK スタック対応表）

```
AWSアカウント (CTF専用)
├── VPC (ctf-vpc-stack)
│   ├── VPC 10.0.0.0/16
│   ├── Public Subnet + NAT GW + IGW
│   ├── Private Subnet × 2
│   └── Security Groups (EC2, Lambda)
│
├── IAM (ctf-iam-stack)
│   ├── User: svc-portal-dev          # 漏洩させるクレデンシャルの持ち主
│   │   └── Policy: PortalDevPolicy (Description にフラグ埋込)
│   ├── User: cto-kawakami            # 不審なIAMユーザー
│   │   └── Policy: CtoEmergencyPolicy
│   ├── User: svc-web-backend         # T6 用 (Flag タグ付き)
│   ├── Role: DataAnalystRole         # AssumeRole先
│   │   └── Policy: DataAnalystPolicy (S3/EC2/Lambda/SSM/ECR/Bedrock/S3 Vectors)
│   ├── Role: EC2InstanceRole         # EC2 Instance Profile
│   ├── Role: LambdaExecutionRole-portal
│   └── Role: LambdaExecutionRole-processor
│
├── S3 (ctf-s3-stack)
│   ├── techvault-public-assets        # パブリック公開
│   ├── techvault-internal-2026        # バージョニング有効
│   ├── tvault-cto-private-7a3f9c      # 隠しバケット
│   └── techvault-cloudtrail-logs      # CloudTrail ログ配信先
│
├── Lambda + API Gateway (ctf-lambda-stack)
│   ├── portal-auth                    # Stage 0: debug レスポンス
│   ├── portal-fetch                   # Stage 3B: SSRF プロキシ
│   ├── portal-chat                    # Stage 1D: Prompt Injection
│   ├── portal-admin                   # Stage 3C: Cognito bypass
│   └── techvault-data-processor       # Stage 2D: 環境変数にフラグ
│
├── EC2 (ctf-ec2-stack)
│   └── internal-data-server
│       ├── IMDSv1 有効, Flask SSRF サーバー
│       └── Tags: Flag, InternalEndpoint
│
├── Cognito (ctf-cognito-stack)
│   └── TechVaultEmployeePool
│       ├── self-signup 有効
│       └── custom:role mutable（脆弱性）
│
├── Secrets Manager + SSM (ctf-secrets-stack)
│   ├── SM: tvault/evidence/password, tvault/internal/db, tvault/cto/backup-key
│   └── SSM: /techvault/internal/api-key, /techvault/internal/db-password, /techvault/config/region
│
├── ECR (ctf-ecr-stack)
│   └── techvault/data-processor (COPY→rm レイヤーパターン)
│
├── Bedrock (ctf-bedrock-stack)
│   └── Agent: TechVaultDataAgent
│
├── S3 Vectors (ctf-bedrock-stack)
│   └── techvault-vault-vectors / customer-vault-documents-titan-v2
│
└── CloudTrail (ctf-cloudtrail-stack)
    └── 全リージョン管理イベントログ + 事前生成ログ
```

### 参加者クレデンシャルの配布方針

**案A: 全員共通**
- メリット: 運営がシンプル
- デメリット: 一人が変更すると全員に影響（IAMポリシー変更など）
- 対策: IAMポリシーで書き込み・変更系を全て拒否

**案B: チームごとに個別**
- メリット: 干渉なし、より本番環境に近い
- デメリット: チーム数分のIAMユーザーとS3バケットを用意する必要がある
- Terraform でテンプレート化すれば対応可能

**推奨: 参加チーム数が10以下なら案B、それ以上なら案A + 書き込み拒否ポリシー**

### コスト見積もり（概算・24時間運営）

| リソース | 概算コスト |
|---------|-----------|
| EC2 (t3.micro × 1) | ~$0.02 |
| Lambda | ほぼ無料（無料枠内） |
| S3 | ~$0.01 |
| Secrets Manager | ~$0.04/シークレット/月 |
| **合計** | **~$1 以下** |

### セキュリティ境界（CTF終了後の削除対象）

- IAM User `svc-portal-dev` とそのアクセスキー
- S3バケット `techvault-internal-2026`（暗号化ファイル含む）
- Secrets Manager の全シークレット
- EC2インスタンス（IMDSv1有効のもの）
- Lambda / API Gateway

---

## ディレクトリ構成

```
season/Cloud-Vault/
├── README.md               # この文書（概要・問題ツリー・スコアリング・インフラ概要）
├── challenges.json          # 全27問のチャレンジデータ（問題データの唯一の情報源）
├── techvault-spec.md        # TechVault社仕様書（会社概要・AWS設計・実装詳細・脆弱性一覧）
│                            # ※ arch/ ディレクトリの固有コンテンツを統合済み
├── arch/                    # AWS インフラパターン（参照元、techvault-spec.md に統合済み）
│   ├── 00-overview.md       # 全体概要
│   ├── 01-network.md        # VPC・Security Group・API Gateway
│   ├── 02-iam.md            # IAMユーザー・ロール・ポリシー全文
│   ├── 03-webapp.md         # フロントエンド・API設計・Lambda疑似コード
│   ├── 04-auth.md           # Cognito詳細設定・認可フロー
│   ├── 05-storage.md        # S3バケット設計・ポリシー
│   ├── 06-data.md           # Lambda(processor)・RDS・SSM・Secrets Manager
│   ├── 07-ai.md             # Bedrock Agent・S3 Vectors・Prompt設計
│   ├── 08-container.md      # ECR・Dockerfile・レイヤー設計
│   ├── 09-cicd.md           # GitHub・Actions・コミット履歴設計
│   ├── 10-monitoring.md     # CloudTrail・CloudWatch・ログ設計
│   └── 11-ec2.md            # EC2インスタンス・IMDSv1・内部APIサーバー
├── scenario/                # シナリオ文書
│   ├── briefing.md          # 参加者向けブリーフィング（ネタバレなし）
│   ├── scenario-guide.md    # 運営者向けシナリオ解説（物語・キャラ・ステージ対応）
│   └── timeline.md          # 運営者向け全時系列（全真相・イベント参照テーブル）
├── assets/                  # 静的アセット
│   ├── cloudtrail-logs.json # CloudTrailログ（427イベント、検証用JSON）
│   ├── cloudtrail-logs.zip # Stage 4 配布用ZIP（生成物）
│   ├── cloudtrail-logs.json.gz # 互換用gzip
│   ├── cloudtrail/          # CloudTrail配信形式のS3オブジェクト
│   │   └── AWSLogs/123456789012/CloudTrail/ap-northeast-1/2026/02/01/
│   └── generate-cloudtrail.py # ログ生成スクリプト（開発ツール）
├── repos/                   # Gitリポジトリ素材
│   ├── setup-repos.sh       # リポジトリ構築スクリプト（冪等）
│   ├── frontend-portal/     # Stage 1C 用（Next.js、14コミット）
│   │   └── commits/         # 各コミットのスナップショット
│   ├── backend-api/         # Stage 2F 用（Express.js、main 10 + old-auth 3コミット）
│   │   └── commits/
│   └── generated/           # 生成されたGitリポジトリ（.gitignore対象）
├── design/                  # TechVaultポータルのUI/UX設計
│   ├── README.md            # 設計ドキュメント概要・インデックス
│   ├── design-tokens.md     # デザイントークン（カラー・タイポグラフィ等）
│   ├── components.md        # 共通UIコンポーネント設計
│   ├── features.md          # 機能設計（認証・API・データフロー）
│   └── pages/               # 画面設計
│       ├── login.md         # ログイン画面
│       ├── dashboard.md     # 従業員ダッシュボード
│       ├── chat.md          # AIアシスタントチャット
│       ├── documents.md     # ドキュメント一覧
│       └── admin.md         # 管理パネル
├── stages.md                # メイン問題の詳細設計
├── stages-additional.md     # 追加問題の詳細設計（全追加問題）
├── stages-beginner.md       # チュートリアルラインの詳細設計
├── flags.md                 # フラグ一覧・配点（配点の唯一の情報源）
├── scoring.md               # スコアリング・運営方針
└── infra-overview.md        # AWSインフラ・コスト・運営方針概要
```

---

## challenges.json について

`challenges.json` はチャレンジ（問題）データの**唯一の情報源（Single Source of Truth）**である。

- 問題定義の正本は `challenges.json` とし、採点プラットフォーム側からインポートして使用する
- この問題サーバーは採点APIやダッシュボードを含まず、問題環境だけを独立してデプロイする
- チャレンジのシード時に、証拠ZIPとStage 4 CloudTrail配布ZIPも `apps/infra/.generated/` 配下へ生成する
- 問題の追加・変更・削除は必ずこのファイルに対して行うこと

### シードスクリプト

```bash
# 問題に必要な生成アセットのみ構築
bun run seed:assets

# プラットフォーム設定のみ投入（管理者チーム + CTF設定）
bun run seed:platform

# 生成アセットを構築してからチャレンジデータのみ投入
bun run seed:challenges

# 既存チャレンジを削除してから再投入
bun run seed:challenges -- --clear

# アセット構築をスキップしてチャレンジデータのみ再投入
bun run seed:challenges -- --skip-assets

# 生成アセットを構築してから全データ投入（プラットフォーム + チャレンジ）
bun run seed
```
