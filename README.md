# Cloud Vault Challenge Server

Cloud Fortress から分離した、CTF「Cloud Vault」の問題サーバーです。参加者がアクセスする TechVault Portal と、問題に必要な AWS リソース、生成アセット、検証用 Solver を含みます。

CDKから構築するBasic認証付きCTFダッシュボードも含みます。全問題の一覧・詳細・ヒント・Flag提出、理解確認の選択式クイズ、ブラウザ内の進捗保存に対応し、ダッシュボードと攻撃対象のTechVault Portalは別々のAPI Gateway（別ドメイン）で公開されます。旧EC2内部サービスは、EC2インスタンスを作らずLambdaエミュレーターで再現します。

イベント運営者向けのユーザー管理、チーム管理、永続ランキング機能は含みません。

> [!WARNING]
> このプロジェクトは CTF のために、漏洩クレデンシャル、過剰権限、SSRF、公開アセットなどの脆弱な構成を意図的に作ります。実運用アカウントや信頼済みネットワークにはデプロイせず、専用AWSアカウントまたはLocalStackで実行してください。

## 構成

```text
apps/
├── portal/          # TechVault Portal（Next.js）
└── infra/           # 問題用 AWS CDK スタック
scenario/solver/     # 問題環境の検証
season/Cloud-Vault/  # 問題定義、設計、運営資料、生成素材
scripts/             # LocalStack、デプロイ、アセット生成
setup/               # 環境別セットアップ手順
```

## 必要なもの

- Bun
- Docker
- AWS CLI
- LocalStack Pro API key（TechVault Portalを含む全環境を構築する場合のみ）
- AWS CDK と 1Password CLI（AWSへデプロイする場合）

## ローカル実行

Portal だけを起動する場合:

```bash
bun install
cp apps/portal/.env.example apps/portal/.env.local
bun run dev
```

Portal は `http://localhost:3000` で起動します。AWSを使う問題まで含めた環境は LocalStack に構築します。

LocalStackを使わず、CTFダッシュボードと問題環境をローカル表示する場合:

```bash
test -f .env || cp .env.example .env
set -a; source .env; set +a
bun run dev:challenge
```

ダッシュボードは `http://localhost:3001`、問題環境は `http://localhost:3002` です。
ダッシュボードの既定Basic認証は `cloudvault` / `vault-ctf-2026` です。

```bash
bun run dev:localstack
```

API key不要のLocalStack Community 4.14へ、全問題を表示するCTFダッシュボードと問題環境をそれぞれ別のLambda + API Gatewayとしてデプロイします。完了時に2つのURLを表示します。TechVault Portalを含む全環境は `LOCALSTACK_API_KEY=... bun run dev:localstack:full` で構築します。詳細は [setup/localstack.md](setup/localstack.md) を参照してください。

## ダッシュボードの環境変数

問題一覧は [season/Cloud-Vault/challenges.json](season/Cloud-Vault/challenges.json) を正とし、CDK deploy前にLambdaへ同期されます。CDKの `synth` / `deploy` 時には以下の環境変数も読み取ります。

| 環境変数 | 内容 | デフォルト |
|---|---|---|
| `CLOUD_VAULT_CTF_EVENT_NAME` | イベント名 | `Cloud Vault CTF` |
| `CLOUD_VAULT_CTF_TITLE` | ダッシュボードのタイトル | Cloud Vault侵害調査 |
| `CLOUD_VAULT_CTF_DESCRIPTION` | ダッシュボードの概要 | TechVaultの調査概要 |
| `CLOUD_VAULT_CTF_TARGET_URL` | 問題環境ボタンのURL | CDKで作成した別ドメイン |
| `CLOUD_VAULT_CTF_FLAG` | Final問題の上書きフラグ | Cloud Vault最終フラグ |
| `CLOUD_VAULT_DASHBOARD_USERNAME` | ダッシュボードのBasic認証ユーザー名 | `cloudvault` |
| `CLOUD_VAULT_DASHBOARD_PASSWORD` | ダッシュボードのBasic認証パスワード | `vault-ctf-2026` |

`CLOUD_VAULT_CTF_FLAG` とBasic認証パスワードはCDKプロセス内でSHA-256化され、CloudFormation/Lambdaにはハッシュだけが保存されます。
productionでは `.env.example` の既定値をそのまま使わず、必ずイベント固有のフラグへ変更してください。

```bash
set -a; source .env; set +a
bun run cdk:synth -- --context stage=local
# または
bun run cdk:deploy:dev
```

## 検証

```bash
bun run typecheck
bun run build
bun run scenario -- --static
```

LocalStack 構築後は `bun run scenario`、AWS dev 環境に対しては `bun run scenario:dev` で検証できます。

## AWS デプロイ

```bash
bun install
CTF_OP_ACCOUNT=<1password-account> bun run cdk:deploy:dev:with-secrets
CTF_STAGE=dev bun run seed:assets
```

- dev: [setup/aws.md](setup/aws.md)
- production: [setup/prod.md](setup/prod.md)

`seed:assets` は CloudTrail/S3素材を生成し、AWS環境ではECR imageとS3 Vectorsデータも投入します。

## 主なコマンド

| コマンド | 内容 |
|---|---|
| `bun run dev` | Portal の開発サーバーを起動 |
| `bun run dev:challenge` | ダッシュボードを3001、問題環境を3002で起動 |
| `bun run setup` | LocalStack Pro の全問題環境を構築 |
| `bun run dev:localstack` | LocalStack Communityへダッシュボードと問題環境を別ドメインで構築 |
| `bun run dev:localstack:full` | LocalStack ProへPortalを含む全環境を構築 |
| `bun run seed:assets` | 問題アセットを生成・投入 |
| `bun run cdk:synth` | CDK テンプレートを生成 |
| `bun run cdk:deploy:dev` | AWS dev へデプロイ |
| `bun run cdk:deploy:prod` | AWS production へデプロイ |
| `bun run scenario` | LocalStack の問題環境を検証 |

## 移植元

Cloud Fortress リポジトリの Cloud Vault 問題環境を元に分離しています。移植元はバックアップ兼比較元として変更していません。
