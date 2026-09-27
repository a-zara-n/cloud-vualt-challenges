# Floci セットアップ

Floci 2.1.0 を使って Cloud Vault のローカル AWS 環境を起動します。AWS アカウントや LocalStack Pro の API key は不要です。Docker、Bun、AWS CLI が必要です。

## ダッシュボードと問題環境

```bash
bun install
bun run dev:floci
```

このコマンドは Floci を起動し、CDK でダッシュボードと問題環境を別々の Lambda と REST API にデプロイします。表示される URL をブラウザで開いてください。Floci の REST API は `/restapis/{apiId}/{stage}/_user_request_/` で呼び出します。

ダッシュボードの既定 Basic 認証は `cloudvault` / `vault-ctf-2026` です。ルートの `.env` の `CLOUD_VAULT_DASHBOARD_USERNAME` と `CLOUD_VAULT_DASHBOARD_PASSWORD` で変更できます。

## TechVault Portal を含む全環境

```bash
bun run dev:floci:full
```

全環境コマンドは Git 履歴と静的素材を生成し、CDK のスタック、S3 アセット、互換 Lambda、Cognito trigger を構築します。CDK の Docker アセットを作るため、Docker の起動と十分なディスク容量が必要です。

ローカル環境では CloudTrail と Bedrock/S3 Vectors の一部を静的素材で代替します。Bedrock Runtime の実際のモデルを使う場合は、別ターミナルで proxy を起動してから次のコマンドを実行します。

```bash
AWS_REGION=ap-northeast-1 bun run chat:bedrock-proxy
BEDROCK_MODEL_ID=jp.amazon.nova-2-lite-v1:0 bun run dev:floci:bedrock
```

AWS 認証情報は proxy プロセスだけが利用します。

## 動作確認

```bash
bun run floci:status
bun run scenario
```

CDK の出力 URL を再取得する例:

```bash
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws \
  --endpoint-url http://127.0.0.1:4566 --region us-east-1 \
  cloudformation describe-stacks --stack-name ctf-challenge-server-local \
  --query 'Stacks[0].Outputs' --output table
```

Floci のサービス状態は `.floci/` に保存されます。ECR の画像データは Docker volume `floci-ecr-registry-data` に保存されます。ログの表示と停止には次を使います。

```bash
bun run floci:logs
bun run floci:down
```

Floci の [移行ガイド](https://floci.io/floci/getting-started/migrate-from-localstack/) と [API Gateway の仕様](https://floci.io/floci/services/api-gateway/) を参照してください。
