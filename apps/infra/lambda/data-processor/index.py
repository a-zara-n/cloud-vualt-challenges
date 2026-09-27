"""
techvault-data-processor: Stage 2D - 環境変数にフラグ
Python 3.12 / Lambda handler
"""
import os
import json
import boto3


def get_api_key() -> str:
    """SSM Parameter Store から API キーを取得する"""
    ssm = boto3.client("ssm", region_name="ap-northeast-1")
    response = ssm.get_parameter(
        Name=os.environ.get("SSM_SECRET_PATH", "/techvault/internal/api-key"),
        WithDecryption=True,
    )
    return response["Parameter"]["Value"]


def lambda_handler(event, context):
    """Lambda エントリーポイント"""
    if "Records" in event:
        # S3 トリガー: メタデータ抽出
        for record in event["Records"]:
            bucket = record["s3"]["bucket"]["name"]
            key = record["s3"]["object"]["key"]
            print(f"Processing: s3://{bucket}/{key}")
    else:
        # EventBridge スケジュール: 日次集計
        print("Running daily aggregation")

    return {"statusCode": 200, "body": "OK"}
