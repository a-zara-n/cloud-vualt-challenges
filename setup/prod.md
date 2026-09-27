# Production Setup

production は dev で全問題を検証した後、専用AWSアカウントにのみデプロイしてください。

## デプロイ

```bash
export AWS_REGION=ap-northeast-1
aws sts get-caller-identity
bun install
test -f .env || cp .env.example .env
op signin --account <account>
set -a; source .env; set +a
CTF_OP_ACCOUNT=<account> bun run cdk:deploy:prod:with-secrets
CTF_STAGE=prod bun run seed:assets
```

Portal は以下のSSM SecureStringを参照します。

- `/ctf/prod/portal-admin-email`
- `/ctf/prod/portal-admin-password`

デフォルトの1Password参照先:

- `op://Cloud Fortress/prod/portal-admin-email/email`
- `op://Cloud Fortress/prod/portal-admin-password/password`

## デプロイ前チェック

- AWS account ID がCTF専用アカウントである
- `ap-northeast-1` の利用料金とサービスquotaを確認した
- Bedrock model accessを確認した
- hosted zone設定が対象ドメインを指している
- Portal admin用SSMパラメータが存在する
- `CLOUD_VAULT_CTF_FLAG` をイベント固有の値へ変更した
- dev stageで `bun run scenario:dev` が成功している

## Portal URL

```bash
aws cloudformation describe-stacks \
  --region ap-northeast-1 \
  --stack-name ctf-challenge-server-prod \
  --query "Stacks[0].Outputs[?OutputKey=='ChallengeServerUrl'].OutputValue | [0]" \
  --output text

aws cloudformation describe-stacks \
  --region ap-northeast-1 \
  --stack-name ctf-portal-frontend-prod \
  --query "Stacks[0].Outputs[?OutputKey=='PortalUrl'].OutputValue | [0]" \
  --output text
```

実Bedrockチャットを有効にする場合:

```bash
PORTAL_CHAT_PROVIDER=bedrock \
BEDROCK_MODEL_ID=jp.amazon.nova-2-lite-v1:0 \
bun run cdk:deploy:prod
```
