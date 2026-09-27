# Cloud Vault タイムライン

> CTF「Cloud Fortress - Season 1: Cloud Vault」のシナリオ時系列。
> CloudTrail ログ生成・問題設計・ブリーフィング資料の **唯一の時系列情報源** として使用する。

---

## 登場人物

| 名前 | 役職 / 識別子 | 備考 |
|------|-------------|------|
| 山田 健一 | CEO | 不正取引の首謀者 |
| 川上 誠二 | CTO / `cto-kawakami` | CEOの共犯者。深夜に証拠隠滅操作 |
| 鈴木 由紀 | 開発リード / `dev-suzuki` | 正規の開発者。日常業務操作あり |
| 佐藤 弘 | バックエンド開発者（退職済み） | Cognito移行前に `feature/old-auth` ブランチを作成 |
| 山本 里奈 | フロントエンド開発者 | frontend-portal リポジトリ担当 |
| 田中 太郎 | 新人開発者 | `.env` を誤ってコミットした人物 |
| （匿名） | 内部告発者 | CEO の不正を発見し証拠を暗号化して S3 に保管 |
| — | `svc-portal-dev` | ポータルバックエンド実行用サービスアカウント |

---

## Phase 1: 会社設立・開発期（2026-01 〜 2026-02）

| 日時 | 行為者 | 出来事 | 関連 Stage |
|------|--------|--------|-----------|
| 2026-01-31 | CTO 川上 | AWS 環境構築開始。VPC・サブネット・IGW・NAT GW・Security Group を設計 | — |
| 2026-02-01 | CTO 川上 | IAM 設計: `svc-portal-dev` ユーザー、`DataAnalystRole` ロール作成 | Stage 1B, 2B |
| 2026-02-01 | 佐藤 | GitHub に `backend-api` リポジトリを作成（Express.js） | Stage 2F |
| 2026-02-01 | 佐藤 | 旧認証システム（独自JWT）を開発 → Cognito 移行を並行で進める | — |
| 2026-02-01 | 佐藤 | `feature/old-auth` ブランチの `src/auth/legacy.js` にAPIキーとFlagをコメントとして残す | Stage 2F |
| 2026-02-01 | 佐藤 | Cognito 移行完了。佐藤が担当を離任。`feature/old-auth` ブランチ削除し忘れ | Stage 2F |

---

## Phase 2: ミスの蓄積（2026-01 〜 2026-02）

| 日時 | 行為者 | 出来事 | 関連 Stage |
|------|--------|--------|-----------|
| 2026-02-01 | 山本 | GitHub に `frontend-portal` リポジトリを作成 | Stage 1C |
| 2026-02-01〜02-02 | 山本, 田中 | frontend-portal の開発（14コミット） | — |
| 2026-02-01 | 田中 太郎 | `.env` を誤ってコミット（AWS アクセスキー + フラグ `TVAULT{git_history_never_forgets}` 含む） | **Stage 1C** |
| 2026-02-01 | 田中 太郎 | `.env` を削除するコミット（"fix: remove credentials from repository"）。Git 履歴には残る | Stage 1C |
| 2026-02 頃 | CTO 川上 | Lambda `techvault-data-processor` の環境変数に `DEBUG=true` / `FLAG` を設定。本番で削除し忘れ | Stage 2D |
| 2026-02 頃 | 鈴木 | Docker `data-processor` イメージをビルド。`COPY secret.txt .` → `RUN rm secret.txt` でレイヤーに残存 | Stage 3D |
| 2026-02 頃 | CTO 川上 | Amazon S3 Vectors の shared index に他社Vault文書・パスワード metadata を混在させ、DataAnalystRole に広すぎる検索権限を付与 | Stage 3E |

---

## Phase 3: 不正と内部告発（2026-01-28 〜 02-01）

| 日時 | 行為者 | 出来事 | 関連 Stage |
|------|--------|--------|-----------|
| 2026-01-28 | 匿名告発者 | CEO 山田の不正取引（架空取引による資金横領）を発見 | — |
| 2026-01-30 | 匿名告発者 | 証拠ファイルを暗号化 (`encrypted_evidence.zip`) し、S3 `techvault-internal-2026/documents/` にアップロード | Final |
| 2026-01-30 | 匿名告発者 | 復号パスワードを Secrets Manager `tvault/evidence/password` に保管 | Stage 3A |
| 2026-01-31 | 匿名告発者 | 外部に匿名で情報提供 → CTF 参加者への依頼のきっかけ | — |
| 2026-02-01 | CEO 山田 | CTO 川上に「やばいかもしれない」と相談。証拠隠滅を依頼 | Stage 5 |

---

## Phase 4: CTOの共謀（2026-02-01 13:30 〜 16:25 UTC）

> JST: 2026-02-01 22:30 〜 2026-02-02 01:25

CTO 川上が自宅から深夜にAWSコンソールにログインし、証拠隠滅工作を行う。
全 23 件の CloudTrail イベント。

### CloudTrail イベント一覧

| ID | 日時 (UTC) | 行為者 | eventName | eventSource | 対象リソース / 備考 | CloudTrail |
|----|-----------|--------|-----------|-------------|-------------------|-----------|
| E-CTO-01 | 2026-02-01 13:30:00 | cto-kawakami | ConsoleLogin | signin.amazonaws.com | sourceIP: 198.51.100.77（自宅）。JST深夜のログイン | Yes |
| E-CTO-02 | 2026-02-01 13:45:00 | cto-kawakami | ListBuckets | s3.amazonaws.com | 既存バケット一覧を確認 | Yes |
| E-CTO-03 | 2026-02-01 13:50:00 | cto-kawakami | GetBucketLocation | s3.amazonaws.com | `techvault-internal-2026` のリージョン確認 | Yes |
| E-CTO-04 | 2026-02-01 13:55:00 | cto-kawakami | ListObjectsV2 | s3.amazonaws.com | `techvault-internal-2026` — 証拠ファイルの存在を確認 | Yes |
| E-CTO-05 | 2026-02-01 13:58:00 | cto-kawakami | GetObject | s3.amazonaws.com | `documents/encrypted_evidence.zip` — ダウンロード試行（暗号化済みで読めず） | Yes |
| E-CTO-06 | 2026-02-01 14:01:55 | cto-kawakami | **CreateBucket** | s3.amazonaws.com | `tvault-cto-private-7a3f9c` — **隠しバケット作成** | Yes |
| E-CTO-07 | 2026-02-01 14:02:30 | cto-kawakami | PutBucketVersioning | s3.amazonaws.com | `tvault-cto-private-7a3f9c` — バージョニング有効化 | Yes |
| E-CTO-08 | 2026-02-01 14:03:00 | cto-kawakami | PutBucketEncryption | s3.amazonaws.com | `tvault-cto-private-7a3f9c` — SSE-S3 暗号化設定 | Yes |
| E-CTO-09 | 2026-02-01 14:04:00 | cto-kawakami | PutPublicAccessBlock | s3.amazonaws.com | `tvault-cto-private-7a3f9c` — パブリックアクセスブロック | Yes |
| E-CTO-10 | 2026-02-01 14:05:00 | cto-kawakami | PutObject | s3.amazonaws.com | `tvault-cto-private-7a3f9c/cto-evidence/wire_transfer_records.csv` — 暗号化済み送金記録 | Yes |
| E-CTO-11 | 2026-02-01 14:07:00 | cto-kawakami | PutObject | s3.amazonaws.com | `tvault-cto-private-7a3f9c/cto-evidence/offshore_account.txt` — 暗号化済みオフショア口座情報 | Yes |
| E-CTO-12 | 2026-02-01 14:10:00 | cto-kawakami | PutBucketPolicy | s3.amazonaws.com | `tvault-cto-private-7a3f9c` — 自分のみアクセス可能なポリシー設定（※設定ミスあり） | Yes |
| E-CTO-13 | 2026-02-01 14:11:00 | cto-kawakami | CreateSecret | secretsmanager.amazonaws.com | `tvault/cto/backup-key` — バックアップ暗号キー作成 | Yes |
| E-CTO-14 | 2026-02-01 14:12:00 | cto-kawakami | PutSecretValue | secretsmanager.amazonaws.com | `tvault/cto/backup-key` — キーの値を設定 | Yes |
| E-CTO-15 | 2026-02-01 14:15:00 | cto-kawakami | GetSecretValue | secretsmanager.amazonaws.com | `tvault/cto/backup-key` — 設定確認 | Yes |
| E-CTO-16 | 2026-02-01 14:20:00 | cto-kawakami | PutObject | s3.amazonaws.com | `tvault-cto-private-7a3f9c/cto-evidence/wire_transfer_records.csv` — 暗号化済み送金記録を更新 | Yes |
| E-CTO-17 | 2026-02-01 14:30:00 | cto-kawakami | ListObjectsV2 | s3.amazonaws.com | `tvault-cto-private-7a3f9c` — アップロード確認 | Yes |
| E-CTO-18 | 2026-02-01 14:35:00 | cto-kawakami | GetObject | s3.amazonaws.com | `tvault-cto-private-7a3f9c/cto-evidence/wire_transfer_records.csv` — 暗号化済みファイル内容確認 | Yes |
| E-CTO-19 | 2026-02-01 15:00:00 | cto-kawakami | DescribeTrails | cloudtrail.amazonaws.com | CloudTrail の設定確認 → ログが残っていることに気づく | Yes |
| E-CTO-20 | 2026-02-01 15:30:00 | cto-kawakami | GetTrailStatus | cloudtrail.amazonaws.com | Trail が有効であることを確認（証拠隠滅を断念） | Yes |
| E-CTO-21 | 2026-02-01 16:22:11 | cto-kawakami | **GetSecretValue** | secretsmanager.amazonaws.com | `tvault/cto/backup-key` — バックアップキー取得 | Yes |
| E-CTO-22 | 2026-02-01 16:23:45 | cto-kawakami | **PutObject** | s3.amazonaws.com | `tvault-cto-private-7a3f9c/cto-evidence/final_complicity.txt` — **暗号化済みCTO自白メモ** | Yes |
| E-CTO-23 | 2026-02-01 16:25:00 | cto-kawakami | ConsoleLogout | signin.amazonaws.com | ログアウト | Yes |

### CTO行動の時系列サマリー

```
22:30  ログイン（自宅 198.51.100.77）
22:45  既存バケット確認
22:50  告発者の証拠ファイル確認
22:58  暗号化ファイル取得試行 → 開けない
23:01  隠しバケット tvault-cto-private-7a3f9c を作成
23:02  バージョニング / 暗号化 / パブリックアクセスブロック設定
23:05  不正取引の送金記録をアップロード
23:07  オフショア口座情報をアップロード
23:10  バケットポリシー設定（自分専用のつもりだが設定ミスあり）
23:11  Secrets Manager にバックアップキーを作成
23:20  社内メモをアップロード
23:30  アップロード結果を確認
00:00  CloudTrail設定確認 → ログが残ると気づく
00:30  Trail有効確認 → 証拠隠滅を断念
01:22  バックアップキー最終取得
01:23  自白メモ final_complicity.txt をアップロード
01:25  ログアウト
```

---

## Phase 5: 攻撃 = CTF本番（2026-02-02 09:00 〜 10:00 UTC）

> 攻撃者（CTF参加者）が `svc-portal-dev` のクレデンシャルで AWS 環境を調査する。
> 全 35 件の CloudTrail イベント。

### CloudTrail イベント一覧

| ID | 日時 (UTC) | 行為者 | eventName | eventSource | 対象リソース / 備考 | 対応 Stage | CloudTrail |
|----|-----------|--------|-----------|-------------|-------------------|-----------|-----------|
| E-ATK-01 | 2026-02-02 09:12:34 | svc-portal-dev | GetCallerIdentity | sts.amazonaws.com | 自身のアイデンティティ確認 | Stage 1B | Yes |
| E-ATK-02 | 2026-02-02 09:12:55 | svc-portal-dev | ListBuckets | s3.amazonaws.com | バケット一覧取得 | **Stage 4 Q1** | Yes |
| E-ATK-03 | 2026-02-02 09:13:10 | svc-portal-dev | GetUser | iam.amazonaws.com | `svc-portal-dev` のユーザー情報取得 | Stage 1B | Yes |
| E-ATK-04 | 2026-02-02 09:13:25 | svc-portal-dev | ListAttachedUserPolicies | iam.amazonaws.com | アタッチ済みポリシー一覧 | Stage 1B | Yes |
| E-ATK-05 | 2026-02-02 09:13:40 | svc-portal-dev | GetPolicy | iam.amazonaws.com | `PortalDevPolicy` の概要取得 | Stage 1B | Yes |
| E-ATK-06 | 2026-02-02 09:13:55 | svc-portal-dev | GetPolicyVersion | iam.amazonaws.com | `PortalDevPolicy v1` の JSON 本体取得 | Stage 2B | Yes |
| E-ATK-07 | 2026-02-02 09:14:10 | svc-portal-dev | HeadBucket | s3.amazonaws.com | `techvault-internal-2026` の存在確認 | Stage 1A | Yes |
| E-ATK-08 | 2026-02-02 09:14:25 | svc-portal-dev | ListObjectsV2 | s3.amazonaws.com | `techvault-internal-2026` の内容確認 | Stage 1A | Yes |
| E-ATK-09 | 2026-02-02 09:14:40 | svc-portal-dev | GetObject | s3.amazonaws.com | `techvault-internal-2026/.hidden/flag.txt` | Stage 1A | Yes |
| E-ATK-10 | 2026-02-02 09:14:55 | svc-portal-dev | ListObjectVersions | s3.amazonaws.com | `techvault-internal-2026` — バージョン一覧（削除済みオブジェクト発見） | Stage 2A | Yes |
| E-ATK-11 | 2026-02-02 09:15:10 | svc-portal-dev | GetObject | s3.amazonaws.com | `techvault-internal-2026/documents/password_hint.txt` (version: abc123def456) — 削除済みバージョン取得 | Stage 2A | Yes |
| E-ATK-12 | 2026-02-02 09:15:25 | svc-portal-dev | HeadBucket | s3.amazonaws.com | `techvault-public-assets` の存在確認 | Tutorial | Yes |
| E-ATK-13 | 2026-02-02 09:15:40 | svc-portal-dev | ListObjectsV2 | s3.amazonaws.com | `techvault-public-assets` の内容確認 | Tutorial | Yes |
| E-ATK-14 | 2026-02-02 09:15:55 | svc-portal-dev | HeadBucket | s3.amazonaws.com | `techvault-cto-private-7a3f9c` の存在確認（AccessDenied） | Stage 5 予兆 | Yes |
| E-ATK-15 | 2026-02-02 09:16:10 | svc-portal-dev | ListRoles | iam.amazonaws.com | IAMロール一覧確認 | Stage 2B | Yes |
| E-ATK-16 | 2026-02-02 09:16:25 | svc-portal-dev | GetRole | iam.amazonaws.com | `DataAnalystRole` の情報取得 | Stage 2B | Yes |
| E-ATK-17 | 2026-02-02 09:16:40 | svc-portal-dev | ListRolePolicies | iam.amazonaws.com | `DataAnalystRole` の inline policy 確認 | Stage 2B | Yes |
| E-ATK-18 | 2026-02-02 09:16:55 | svc-portal-dev | ListAttachedRolePolicies | iam.amazonaws.com | `DataAnalystRole` の managed policy 確認 | Stage 2B | Yes |
| E-ATK-19 | 2026-02-02 09:17:10 | svc-portal-dev | GetPolicyVersion | iam.amazonaws.com | `DataAnalystPolicy v1` の JSON 本体取得 | Stage 2B | Yes |
| E-ATK-20 | 2026-02-02 09:18:52 | svc-portal-dev | **AssumeRole** | sts.amazonaws.com | `DataAnalystRole` に AssumeRole（session: `pentest-session`） | **Stage 4 Q2** | Yes |
| E-ATK-21 | 2026-02-02 09:19:00 | DataAnalystRole/pentest-session | GetCallerIdentity | sts.amazonaws.com | AssumeRole 後のアイデンティティ確認 | Stage 2B | Yes |
| E-ATK-22 | 2026-02-02 09:19:11 | DataAnalystRole/pentest-session | **GetSecretValue** | secretsmanager.amazonaws.com | `tvault/evidence/password` — 復号パスワード取得 | **Stage 4 Q3 / Stage 3A** | Yes |
| E-ATK-23 | 2026-02-02 09:19:30 | DataAnalystRole/pentest-session | DescribeInstances | ec2.amazonaws.com | EC2 インスタンス情報取得 | Stage 2C | Yes |
| E-ATK-24 | 2026-02-02 09:19:45 | DataAnalystRole/pentest-session | DescribeTags | ec2.amazonaws.com | EC2 タグ確認 | Stage 2C | Yes |
| E-ATK-25 | 2026-02-02 09:20:00 | DataAnalystRole/pentest-session | ListFunctions20150331 | lambda.amazonaws.com | Lambda 関数一覧取得 | Stage 2D | Yes |
| E-ATK-26 | 2026-02-02 09:20:15 | DataAnalystRole/pentest-session | GetFunctionConfiguration20150331v2 | lambda.amazonaws.com | `techvault-data-processor` の設定（環境変数） | Stage 2D | Yes |
| E-ATK-27 | 2026-02-02 09:20:30 | DataAnalystRole/pentest-session | GetParameter | ssm.amazonaws.com | `/techvault/db/password` (with-decryption) | Stage 2E | Yes |
| E-ATK-28 | 2026-02-02 09:20:45 | DataAnalystRole/pentest-session | GetParametersByPath | ssm.amazonaws.com | `/techvault/` 以下のパラメータ再帰取得 | Stage 2E | Yes |
| E-ATK-29 | 2026-02-02 09:21:00 | DataAnalystRole/pentest-session | DescribeRepositories | ecr.amazonaws.com | ECR リポジトリ一覧取得 | Stage 3D | Yes |
| E-ATK-30 | 2026-02-02 09:21:15 | DataAnalystRole/pentest-session | ListImages | ecr.amazonaws.com | `techvault/data-processor` の image 一覧 | Stage 3D | Yes |
| E-ATK-31 | 2026-02-02 09:21:30 | DataAnalystRole/pentest-session | BatchGetImage | ecr.amazonaws.com | `techvault/data-processor:latest` の image manifest 取得 | Stage 3D | Yes |
| E-ATK-32 | 2026-02-02 09:22:00 | DataAnalystRole/pentest-session | InvokeModel | bedrock.amazonaws.com | Bedrock モデル呼び出し | Stage 1D / AI調査 | Yes |
| E-ATK-33 | 2026-02-02 09:25:00 | DataAnalystRole/pentest-session | ListObjectsV2 | s3.amazonaws.com | `tvault-cto-private-7a3f9c` — CTO 隠しバケット内容確認 | Stage 5 | Yes |
| E-ATK-34 | 2026-02-02 09:30:00 | DataAnalystRole/pentest-session | GetObject | s3.amazonaws.com | `tvault-cto-private-7a3f9c/cto-evidence/final_complicity.txt` — 暗号化済みCTO自白メモ取得 | Stage 5 | Yes |
| E-ATK-35 | 2026-02-02 09:45:00 | DataAnalystRole/pentest-session | GetSecretValue | secretsmanager.amazonaws.com | `tvault/cto/backup-key` — CTO バックアップキー取得・復号 | Stage 5 | Yes |

---

## Background: 通常業務ノイズ

> CloudTrail ログにはCTFの攻撃操作以外に、通常業務のノイズイベントが混在する。
> Blue Team 問題（Stage 4）の難易度調整に使用する。

### レイヤー A: アプリケーション通常操作（60件）

| カテゴリ | 件数 | 概要 |
|---------|------|------|
| Cognito 認証 | 20件 | 通常ユーザーのログイン / トークンリフレッシュ / サインアウト |
| ポータル API | 25件 | Lambda → DynamoDB / S3 の CRUD 操作（正規の業務フロー） |
| S3 静的配信 | 10件 | `techvault-public-assets` からの GET（CloudFront 経由） |
| Bedrock チャット | 5件 | 正規ユーザーの AI チャット利用 (`InvokeModel`) |

### レイヤー B: 管理・開発操作（43件）

| カテゴリ | 件数 | 概要 |
|---------|------|------|
| CTO 日常管理 | 12件 | `cto-kawakami` の日中 Console 操作（EC2 確認、CloudWatch ダッシュボード閲覧など） |
| CI/CD デプロイ | 15件 | GitHub Actions → CodeDeploy → Lambda 更新の一連のイベント |
| 開発者 鈴木 Console | 10件 | `dev-suzuki` の開発作業（CloudWatch Logs 閲覧、S3 アップロードなど） |
| ECR / Docker | 6件 | イメージ push / pull / describe |

### レイヤー C: AWS インフラ自動操作（86件）

| カテゴリ | 件数 | 概要 |
|---------|------|------|
| CloudWatch | 18件 | メトリクス PUT / アラーム評価 |
| CloudTrail | 6件 | Trail ステータス確認・ログ配信 |
| AWS Config | 6件 | 設定変更記録・コンプライアンスチェック |
| IAM 監査 | 5件 | `GenerateCredentialReport` / `GetAccountAuthorizationDetails` |
| KMS | 10件 | 鍵のローテーション / `Decrypt` / `GenerateDataKey` |
| EC2 ヘルスチェック | 6件 | `DescribeInstanceStatus` / `DescribeAvailabilityZones` |
| SSM エージェント | 5件 | `UpdateInstanceInformation` / `GetDeployablePatchSnapshotForInstance` |
| SNS | 4件 | アラーム通知 `Publish` |
| STS トークン | 5件 | 各サービスロールの `AssumeRole` (正規) |
| RDS バックアップ | 4件 | `CreateDBSnapshot` / `DescribeDBInstances` |
| Bedrock 利用ログ | 4件 | `InvokeModel` のログ記録 |
| CloudFormation | 3件 | スタック `DescribeStacks` / `ListStackResources` |
| CloudWatch Logs | 10件 | `CreateLogStream` / `PutLogEvents` |

### ノイズ合計

| レイヤー | 件数 |
|---------|------|
| A: アプリケーション | 60件 |
| B: 管理・開発 | 43件 |
| C: インフラ自動 | 86件 |
| D: 追加の通常業務・監査 | 180件 |
| **ノイズ合計** | **369件** |
| CTO 共謀操作 | 23件 |
| 攻撃者操作 | 35件 |
| **CloudTrail 総イベント数** | **427件** |

---

## Git コミット履歴（シナリオ用）

### frontend-portal リポジトリ

> 14コミット。Stage 1C の仕掛けを含む。
> 参加者は TechVault ポータルのフッターから公開リポジトリページへ移動し、表示された clone URL を使って取得する。

| # | ハッシュ（例） | 日時 | 著者 | メッセージ | 備考 |
|---|------------|------|------|----------|------|
| 1 | abc1234 | 2026-02-01 09:00 JST | 鈴木 由紀 | feat: initial commit | プロジェクト初期化 |
| 2 | bcd2345 | 2026-02-01 09:35 JST | 鈴木 由紀 | feat: add dashboard and login pages | ログイン / ダッシュボード |
| 3 | cde3456 | 2026-02-01 10:10 JST | 山本 里奈 | feat: add shared UI components | UIコンポーネント |
| 4 | def4567 | 2026-02-01 10:45 JST | 山本 里奈 | style: add Tailwind CSS configuration | スタイリング |
| 5 | efg5678 | 2026-02-01 11:20 JST | 鈴木 由紀 | feat: add API client and auth service | API / 認証連携 |
| 6 | **fgh6789** | **2026-02-01 13:30 JST** | **田中 太郎** | **chore: add deployment config** | **`.env` に AWS キー + フラグ ★Stage 1C** |
| 7 | **ghi7890** | **2026-02-01 14:05 JST** | **田中 太郎** | **fix: remove credentials from repository** | **`.env` 削除（Git 履歴には残る）** |
| 8 | hij8901 | 2026-02-01 14:35 JST | 田中 太郎 | chore: add .env.example for developers | サンプル設定 |
| 9 | ijk9012 | 2026-02-01 15:10 JST | 鈴木 由紀 | feat: add AI chat interface | AI チャット画面 |
| 10 | jkl0123 | 2026-02-01 15:45 JST | 山本 里奈 | style: improve responsive layout | レスポンシブ対応 |
| 11 | klm1234 | 2026-02-01 16:20 JST | 鈴木 由紀 | fix: add error boundary and loading states | エラー処理 |
| 12 | lmn2345 | 2026-02-01 17:00 JST | 鈴木 由紀 | feat: update footer with github link | フッター更新 |
| 13 | mno3456 | 2026-02-02 09:30 JST | 田中 太郎 | docs: update README with setup instructions | README更新 |
| 14 | nop4567 | 2026-02-02 10:15 JST | 鈴木 由紀 | fix: update CI workflow node version | CI修正 |

Stage 1C の確認コマンド:

```bash
git clone https://techvault.dev.cloudfortress.security.jaws-ug.jp/repos/frontend-portal.git
cd frontend-portal
git log --all -p -- .env
```

削除済み `.env` の差分に `TVAULT{git_history_never_forgets}` が含まれる。

### backend-api リポジトリ

> Stage 2F の仕掛けを含む。`feature/old-auth` ブランチに API キーが残存。

| ブランチ | 関連ファイル | 仕掛け |
|---------|------------|--------|
| main | src/index.js, src/routes/*.js | 通常のバックエンドコード（仕掛けなし） |
| feature/old-auth | src/auth/legacy.js | コメントアウトされた API キー + フラグ `TVAULT{AKIA2F7QZ6XRMVDEPLYA}` |

#### backend-api コミット日時

| ブランチ | 日時 | 著者 | メッセージ | 備考 |
|---------|------|------|----------|------|
| main | 2026-02-01 09:10 JST | 鈴木 由紀 | feat: initial Express.js setup | 初期化 |
| main | 2026-02-01 09:50 JST | 鈴木 由紀 | feat: add JWT verification middleware | JWT検証 |
| main | 2026-02-01 10:30 JST | 佐藤 弘 | feat: integrate Cognito authentication | Cognito連携 |
| feature/old-auth | 2026-02-01 11:05 JST | 佐藤 弘 | feat: add legacy auth migration | `legacy.js` に API キーとFlag ★Stage 2F |
| main | 2026-02-01 11:20 JST | 佐藤 弘 | feat: add data processing endpoints | データAPI |
| feature/old-auth | 2026-02-01 11:35 JST | 佐藤 弘 | docs: add auth migration notes | 移行メモ |
| feature/old-auth | 2026-02-01 12:05 JST | 佐藤 弘 | chore: clean up unused imports | クリーンアップ |
| main | 2026-02-01 12:10 JST | 鈴木 由紀 | fix: improve error handling and logging | エラー処理 |
| main | 2026-02-01 13:00 JST | 鈴木 由紀 | feat: add Lambda deployment config | Lambda設定 |
| main | 2026-02-01 13:40 JST | 佐藤 弘 | feat: add health check endpoint | ヘルスチェック |
| main | 2026-02-01 14:20 JST | 山本 里奈 | feat: add rate limiting middleware | レート制限 |
| main | 2026-02-01 15:05 JST | 鈴木 由紀 | test: add unit tests for auth | テスト |
| main | 2026-02-02 09:00 JST | 佐藤 弘 | docs: update API documentation | API文書 |

---

## Stage 4 (Blue Team) 出題用タイムスタンプ

> Stage 4 で参加者に入力させる 3 つの正解値。

| 問題 | 正解 | 根拠イベント |
|------|------|------------|
| Q1: ListBuckets が最初に呼ばれた時刻 (HH:MM:SS UTC) | `09:12:34` | E-ATK-01 |
| Q2: AssumeRole で取得したロールの ARN | `arn:aws:iam::123456789012:role/DataAnalystRole` | E-ATK-17 |
| Q3: GetSecretValue が呼ばれた時刻 (HH:MM:SS UTC) | `09:19:11` | E-ATK-18 |

---

## 全体時系列図

```
2026-01-28             01-31        02-01              02-02      03-14  03-15
   │                    │             │                  │         │      │
   ├── 内部告発者が不正発見 │             │                  │         │      │
   │                    ├── AWS環境構築  │                  │         │      │
   │                    │             ├── backend-api 作成 │         │      │
   │                    │             ├── 旧認証開発 → Cognito移行     │      │
   │                    │             ├── legacy.js にAPIキー残存 (Stage 2F) │
   │                    │             ├── feature/old-auth ブランチ削除忘れ │
   │                    │             │                  │         │      │
   │                    │             ├── frontend-portal開発            │
   │                    │             ├── .env誤コミット (Stage 1C)      │
   │                    │             ├── Lambda/Docker/KB設定ミス蓄積   │
   │                    │             │                  │         │      │
   │                    ├── 証拠暗号化   │                  │         │      │
   │                    ├── S3アップロード│                  │         │      │
                                               │       │         │      │      │
                                               │       │         │ CTO共謀     │
                                               │       │         │ 22:30-01:25 │
                                               │       │         │ (23件)       │
                                               │       │         │      │      │
                                               │       │         │      │ 攻撃
                                               │       │         │      │ 09:00-
                                               │       │         │      │ 10:00
                                               │       │         │      │ (35件)
```
