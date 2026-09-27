# LocalStack Setup

CTFダッシュボードと簡易問題環境はLocalStack Communityへ別ドメインで構築します。TechVault Portalを含む全問題環境はLocalStack Proへ構築します。

## 前提

- Docker が起動している
- Bun と AWS CLI が利用できる
- 全環境を構築する場合のみLocalStack Pro API keyを利用できる

## 起動

```bash
bun install
bun run dev:localstack
```

このコマンドはAPI key不要のCommunity 4.14版を起動し、全問題用ダッシュボードと問題環境を別々のLambda + API GatewayへCDKでデプロイします。2026年3月以降の最新版は認証トークン必須のため、認証不要だった最終Community版へ固定しています。

ダッシュボードにはBasic認証が必要です。既定値は `cloudvault` / `vault-ctf-2026` で、ルートの `.env` にある `CLOUD_VAULT_DASHBOARD_USERNAME` と `CLOUD_VAULT_DASHBOARD_PASSWORD` で変更できます。問題環境側にはBasic認証を適用しません。

旧EC2内部サービス、EC2タグ、IMDSv1の問題はLambda + API Gatewayのエミュレーターで再現するため、EC2インスタンスは起動しません。

TechVault Portalを含む全環境を構築する場合:

```bash
LOCALSTACK_API_KEY=... bun run dev:localstack:full
```

全環境用コマンドは次を行います。

1. CTF用Git履歴と静的アセットを生成
2. LocalStack を起動
3. CDK bootstrap と `ctf-*-local` のデプロイ
4. S3、CloudTrail、ECR、互換Lambda、Cognito trigger を投入
5. CTFダッシュボードと問題環境の別ドメインURLを表示

LocalStack では CloudTrail と Bedrock/S3 Vectors の一部を静的素材で代替します。

## Bedrock Runtime をAWSへ中継する

別ターミナルでproxyを起動してから問題環境を構築します。

```bash
AWS_REGION=ap-northeast-1 bun run chat:bedrock-proxy
BEDROCK_MODEL_ID=jp.amazon.nova-2-lite-v1:0 bun run dev:localstack:bedrock
```

AWS認証情報はproxyプロセスだけが利用し、LocalStack Lambdaには渡しません。

## URL の再取得

```bash
aws --endpoint-url http://127.0.0.1:4566 \
  --region us-east-1 cloudformation describe-stacks \
  --stack-name ctf-challenge-server-local \
  --query "Stacks[0].Outputs[?OutputKey=='ChallengeServerUrl'].OutputValue | [0]" \
  --output text

aws --endpoint-url http://127.0.0.1:4566 \
  --region us-east-1 cloudformation describe-stacks \
  --stack-name ctf-challenge-server-local \
  --query "Stacks[0].Outputs[?OutputKey=='ProblemServerUrl'].OutputValue | [0]" \
  --output text

aws --endpoint-url http://127.0.0.1:4566 \
  --region us-east-1 cloudformation describe-stacks \
  --stack-name ctf-portal-frontend-local \
  --query "Stacks[0].Outputs[?OutputKey=='PortalUrl'].OutputValue | [0]" \
  --output text

aws --endpoint-url http://127.0.0.1:4566 \
  --region us-east-1 cloudformation describe-stacks \
  --stack-name ctf-ec2-local \
  --query "Stacks[0].Outputs[?OutputKey=='EmulatedDescribeInstancesEndpoint'].OutputValue | [0]" \
  --output text
```

ダッシュボードの表示内容は、CDK deploy前にルートの `.env.example` に記載された `CLOUD_VAULT_CTF_*` 環境変数で変更できます。問題一覧は `season/Cloud-Vault/challenges.json` から同期されます。

## ログイン情報

| 対象 | ID | パスワード |
|---|---|---|
| TechVault employee | `employee@techvault.example` | `EmployeePass2026!` |
| TechVault admin | `admin@techvault.example` | `SuperSecretPass2026!` |

これらはCTF用の意図的な固定値です。外部公開環境では利用しないでください。

## 検証と停止

```bash
bun run scenario
bun run localstack:logs
bun run localstack:down
```
