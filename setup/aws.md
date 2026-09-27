# AWS Dev Setup

Cloud Vault 問題環境を専用AWSアカウントの dev stage へデプロイします。

> [!CAUTION]
> 意図的に脆弱なIAM、S3、EC2、Lambda、Cognito、Bedrock構成を作成します。業務用アカウントでは実行しないでください。

## 前提

- `aws sts get-caller-identity` で専用アカウントへ認証済み
- `ap-northeast-1` を利用できる
- Bun、Docker、AWS CDK、1Password CLIを利用できる
- Route 53 hosted zone と Bedrock model access を必要に応じて準備済み

## シークレットとデプロイ

Portal admin のメールアドレスとパスワードは1PasswordからSSM SecureStringへ投入します。

```bash
export AWS_REGION=ap-northeast-1
aws sts get-caller-identity
bun install
test -f .env || cp .env.example .env
op signin --account <account>
set -a; source .env; set +a
CTF_OP_ACCOUNT=<account> bun run cdk:deploy:dev:with-secrets
CTF_STAGE=dev bun run seed:assets
```

デフォルトの1Password参照先:

- `op://Cloud Fortress/dev/portal-admin-email/email`
- `op://Cloud Fortress/dev/portal-admin-password/password`

参照先は `CTF_PORTAL_ADMIN_EMAIL_OP_REF` と `CTF_PORTAL_ADMIN_PASSWORD_OP_REF` で変更できます。

`seed:assets` はECR imageをpushし、Titan Text Embeddings V2を使ってS3 Vectorsを投入します。不要な処理は次の環境変数で止められます。

```bash
CTF_SKIP_ECR_PUSH=true CTF_STAGE=dev bun run seed:assets
CTF_SKIP_S3_VECTORS=true CTF_STAGE=dev bun run seed:assets
```

## Portal URL

```bash
aws cloudformation describe-stacks \
  --region ap-northeast-1 \
  --stack-name ctf-challenge-server-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ChallengeServerUrl'].OutputValue | [0]" \
  --output text

aws cloudformation describe-stacks \
  --region ap-northeast-1 \
  --stack-name ctf-portal-frontend-dev \
  --query "Stacks[0].Outputs[?OutputKey=='PortalUrl'].OutputValue | [0]" \
  --output text
```

## 実Bedrockチャットを有効にする

```bash
PORTAL_CHAT_PROVIDER=bedrock \
BEDROCK_MODEL_ID=jp.amazon.nova-2-lite-v1:0 \
bun run cdk:deploy:dev
```

## 検証

```bash
bun run scenario:dev
```
