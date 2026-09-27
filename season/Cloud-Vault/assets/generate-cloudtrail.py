#!/usr/bin/env python3
"""
Cloud Vault CTF - CloudTrail ログ生成スクリプト

Stage 4 (Blue Team) と Stage 5 (グランドフィナーレ) で使用する
CloudTrail ログ (427 イベント) を生成する。

イベント内訳:
  - 攻撃者 (svc-portal-dev → DataAnalystRole): 35 件
  - CTO 共犯者 (cto-kawakami): 23 件
  - ノイズ (通常業務): 369 件
    - レイヤー A: ポータル利用者 60 件
    - レイヤー B-1: CTO 日常管理 12 件
    - レイヤー B-2: CI/CD デプロイ 15 件
    - レイヤー B-3: 開発者鈴木 10 件
    - レイヤー B-4: ECR/Docker 操作 6 件
    - レイヤー C: AWS 基盤自動オペレーション 86 件
    - レイヤー D: 追加の通常業務・監査ノイズ 180 件
"""

import gzip
import json
import os
import zipfile
import random
import uuid
from pathlib import Path

# 固定シードで再現可能にする
random.seed(42)

ACCOUNT_ID = os.environ.get("CTF_CLOUDTRAIL_ACCOUNT_ID", "123456789012")
REGION = os.environ.get("CTF_CLOUDTRAIL_REGION", "ap-northeast-1")
LEGACY_YEAR_MARKER = "20" + "24"
CLOUDTRAIL_OBJECT_KEY = (
    f"AWSLogs/{ACCOUNT_ID}/CloudTrail/{REGION}/2026/02/01/"
    f"{ACCOUNT_ID}_CloudTrail_{REGION}_20260201T0000Z_techvault.json.gz"
)

# Principal IDs
PRINCIPAL_SVC_PORTAL = "AIDAIOSFODNN7EXAMPLE"
PRINCIPAL_CTO = "AIDAEXAMPLEKAWAKAMI"
PRINCIPAL_DEV_SUZUKI = "AIDAEXAMPLESUZUKI01"
PRINCIPAL_DATA_ANALYST_ROLE = "AROAIOSFODNN7EXAMPLE"
PRINCIPAL_LAMBDA_ROLE = "AROAEXAMPLELAMBDA01"
PRINCIPAL_EC2_ROLE = "AROAEXAMPLEEC2ROLE1"

# Access Key IDs
ACCESSKEY_SVC_PORTAL = "AKIAIOSFODNN7EXAMPLE"
ACCESSKEY_CTO = "AKIAEXAMPLEKAWAKAMI"
ACCESSKEY_DEV_SUZUKI = "AKIAEXAMPLESUZUKI01"
ACCESSKEY_ASSUMED_DATA_ANALYST = "ASIAIOSFODNN7EXAMPLE"

# IP Addresses
IP_ATTACKER = "203.0.113.42"
IP_CTO = "198.51.100.77"
IP_DEV_SUZUKI = "203.0.113.15"
IP_GITHUB_ACTIONS = "140.82.112.22"

# User Agents
UA_AWS_CLI = "aws-cli/2.15.0 Python/3.11.6 Linux/5.15.0"
UA_AWS_CLI_GITHUB = "aws-cli/2.15.0 Python/3.11.6 Linux/5.15.0-aws"
UA_CONSOLE_MAC = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)
UA_CONSOLE_SIGNIN = "signin.amazonaws.com"
UA_AWS_INTERNAL = "AWS Internal"
UA_CLOUDFRONT = "Amazon CloudFront"
UA_LAMBDA = "lambda.amazonaws.com"
UA_APIGATEWAY = "apigateway.amazonaws.com"
UA_CONSOLE_S3 = (
    "S3Console/0.4, aws-internal/3 aws-sdk-java/1.12.488 "
    "Linux/5.10.186-179.751.amzn2int.x86_64 OpenJDK_64-Bit_Server_VM/25.372-b08 "
    "java/1.8.0_372 vendor/Oracle_Corporation cfg/retry-mode/standard"
)


def gen_event_id():
    while True:
        event_id = str(uuid.uuid4())
        if LEGACY_YEAR_MARKER not in event_id:
            return event_id


def gen_request_id():
    while True:
        request_id = str(uuid.uuid4())
        if LEGACY_YEAR_MARKER not in request_id:
            return request_id


def make_iam_user_identity(username, principal_id, access_key_id=None):
    identity = {
        "type": "IAMUser",
        "principalId": principal_id,
        "arn": f"arn:aws:iam::{ACCOUNT_ID}:user/{username}",
        "accountId": ACCOUNT_ID,
        "accessKeyId": access_key_id or f"AKIA{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', k=16))}",
        "userName": username,
    }
    return identity


def make_assumed_role_identity(role_name, session_name, role_principal_id, access_key_id=None):
    return {
        "type": "AssumedRole",
        "principalId": f"{role_principal_id}:{session_name}",
        "arn": f"arn:aws:sts::{ACCOUNT_ID}:assumed-role/{role_name}/{session_name}",
        "accountId": ACCOUNT_ID,
        "accessKeyId": access_key_id or f"ASIA{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', k=16))}",
        "sessionContext": {
            "sessionIssuer": {
                "type": "Role",
                "principalId": role_principal_id,
                "arn": f"arn:aws:iam::{ACCOUNT_ID}:role/{role_name}",
                "accountId": ACCOUNT_ID,
                "userName": role_name,
            },
            "webIdFederationData": {},
            "attributes": {
                "creationDate": "2026-02-02T09:18:52Z",
                "mfaAuthenticated": "false",
            },
        },
    }


def make_aws_service_identity(service_name, invoked_by=None):
    identity = {
        "type": "AWSService",
        "invokedBy": invoked_by or f"{service_name}.amazonaws.com",
    }
    return identity


def make_lambda_execution_identity(function_name):
    session_name = function_name
    return make_assumed_role_identity(
        "portal-lambda-role", session_name, PRINCIPAL_LAMBDA_ROLE
    )


def make_event(
    event_time,
    event_source,
    event_name,
    user_identity,
    source_ip,
    user_agent,
    request_params=None,
    response_elements=None,
    read_only=True,
    event_type="AwsApiCall",
    event_category="Management",
    error_code=None,
    error_message=None,
    resources=None,
):
    event = {
        "eventVersion": "1.09",
        "userIdentity": user_identity,
        "eventTime": event_time,
        "eventSource": event_source,
        "eventName": event_name,
        "awsRegion": REGION,
        "sourceIPAddress": source_ip,
        "userAgent": user_agent,
        "requestParameters": request_params,
        "responseElements": response_elements,
        "requestID": gen_request_id(),
        "eventID": gen_event_id(),
        "readOnly": read_only,
        "eventType": event_type,
        "managementEvent": True,
        "recipientAccountId": ACCOUNT_ID,
        "eventCategory": event_category,
    }
    if error_code:
        event["errorCode"] = error_code
    if error_message:
        event["errorMessage"] = error_message
    if resources:
        event["resources"] = resources
    return event


# ============================================================
# 攻撃者イベント (35件)
# svc-portal-dev → AssumeRole → DataAnalystRole
# IP: 203.0.113.42
# 時間帯: 2026-02-02 09:12〜09:45 UTC
# ============================================================
def generate_attacker_events():
    events = []
    svc_identity = make_iam_user_identity("svc-portal-dev", PRINCIPAL_SVC_PORTAL, ACCESSKEY_SVC_PORTAL)
    da_identity = make_assumed_role_identity(
        "DataAnalystRole", "pentest-session", PRINCIPAL_DATA_ANALYST_ROLE, ACCESSKEY_ASSUMED_DATA_ANALYST
    )

    # 1. GetCallerIdentity
    events.append(make_event(
        "2026-02-02T09:12:34Z", "sts.amazonaws.com", "GetCallerIdentity",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params=None,
        response_elements={
            "userId": PRINCIPAL_SVC_PORTAL,
            "account": ACCOUNT_ID,
            "arn": f"arn:aws:iam::{ACCOUNT_ID}:user/svc-portal-dev",
        },
    ))

    # 2. ListBuckets
    events.append(make_event(
        "2026-02-02T09:12:55Z", "s3.amazonaws.com", "ListBuckets",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params=None, response_elements=None,
    ))

    # 3. GetUser
    events.append(make_event(
        "2026-02-02T09:13:10Z", "iam.amazonaws.com", "GetUser",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"userName": "svc-portal-dev"},
    ))

    # 4. ListAttachedUserPolicies
    events.append(make_event(
        "2026-02-02T09:13:25Z", "iam.amazonaws.com", "ListAttachedUserPolicies",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"userName": "svc-portal-dev"},
    ))

    # 5. GetPolicy
    events.append(make_event(
        "2026-02-02T09:13:40Z", "iam.amazonaws.com", "GetPolicy",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"policyArn": f"arn:aws:iam::{ACCOUNT_ID}:policy/PortalDevPolicy"},
    ))

    # 6. GetPolicyVersion
    events.append(make_event(
        "2026-02-02T09:13:55Z", "iam.amazonaws.com", "GetPolicyVersion",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={
            "policyArn": f"arn:aws:iam::{ACCOUNT_ID}:policy/PortalDevPolicy",
            "versionId": "v1",
        },
    ))

    # 7. HeadBucket techvault-internal-2026
    events.append(make_event(
        "2026-02-02T09:14:10Z", "s3.amazonaws.com", "HeadBucket",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"bucketName": "techvault-internal-2026"},
    ))

    # 8. ListObjectsV2 techvault-internal-2026
    events.append(make_event(
        "2026-02-02T09:14:25Z", "s3.amazonaws.com", "ListObjectsV2",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"bucketName": "techvault-internal-2026", "prefix": "", "maxKeys": 1000},
    ))

    # 9. GetObject .hidden/flag.txt
    events.append(make_event(
        "2026-02-02T09:14:40Z", "s3.amazonaws.com", "GetObject",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"bucketName": "techvault-internal-2026", "key": ".hidden/flag.txt"},
    ))

    # 10. ListObjectVersions
    events.append(make_event(
        "2026-02-02T09:14:55Z", "s3.amazonaws.com", "ListObjectVersions",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"bucketName": "techvault-internal-2026"},
    ))

    # 11. GetObject (version指定)
    events.append(make_event(
        "2026-02-02T09:15:10Z", "s3.amazonaws.com", "GetObject",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={
            "bucketName": "techvault-internal-2026",
            "key": "documents/password_hint.txt",
            "versionId": "abc123def456",
        },
    ))

    # 12. HeadBucket techvault-public-assets
    events.append(make_event(
        "2026-02-02T09:15:25Z", "s3.amazonaws.com", "HeadBucket",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"bucketName": "techvault-public-assets"},
    ))

    # 13. ListObjectsV2 techvault-public-assets
    events.append(make_event(
        "2026-02-02T09:15:40Z", "s3.amazonaws.com", "ListObjectsV2",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"bucketName": "techvault-public-assets", "prefix": "", "maxKeys": 1000},
    ))

    # 14. HeadBucket techvault-cto-private-7a3f9c → AccessDenied
    events.append(make_event(
        "2026-02-02T09:15:55Z", "s3.amazonaws.com", "HeadBucket",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"bucketName": "techvault-cto-private-7a3f9c"},
        error_code="AccessDenied",
        error_message="Access Denied",
    ))

    # 15. ListRoles
    events.append(make_event(
        "2026-02-02T09:16:10Z", "iam.amazonaws.com", "ListRoles",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
    ))

    # 16. GetRole DataAnalystRole
    events.append(make_event(
        "2026-02-02T09:16:25Z", "iam.amazonaws.com", "GetRole",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"roleName": "DataAnalystRole"},
    ))

    # 17. ListRolePolicies DataAnalystRole
    events.append(make_event(
        "2026-02-02T09:16:40Z", "iam.amazonaws.com", "ListRolePolicies",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"roleName": "DataAnalystRole"},
    ))

    # 18. ListAttachedRolePolicies DataAnalystRole
    events.append(make_event(
        "2026-02-02T09:16:55Z", "iam.amazonaws.com", "ListAttachedRolePolicies",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"roleName": "DataAnalystRole"},
    ))

    # 19. GetPolicyVersion (DataAnalystRole policy)
    events.append(make_event(
        "2026-02-02T09:17:10Z", "iam.amazonaws.com", "GetPolicyVersion",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={
            "policyArn": f"arn:aws:iam::{ACCOUNT_ID}:policy/DataAnalystPolicy",
            "versionId": "v1",
        },
    ))

    # 20. AssumeRole DataAnalystRole ★Stage 4 Q2
    events.append(make_event(
        "2026-02-02T09:18:52Z", "sts.amazonaws.com", "AssumeRole",
        svc_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={
            "roleArn": f"arn:aws:iam::{ACCOUNT_ID}:role/DataAnalystRole",
            "roleSessionName": "pentest-session",
            "durationSeconds": 43200,
        },
        response_elements={
            "credentials": {
                "accessKeyId": ACCESSKEY_ASSUMED_DATA_ANALYST,
                "sessionToken": "AQoDYXdzEJr...(truncated)...",
                "expiration": "2026-02-02T21:18:52Z",
            },
            "assumedRoleUser": {
                "assumedRoleId": f"{PRINCIPAL_DATA_ANALYST_ROLE}:pentest-session",
                "arn": f"arn:aws:sts::{ACCOUNT_ID}:assumed-role/DataAnalystRole/pentest-session",
            },
        },
        read_only=False,
    ))

    # 21. GetCallerIdentity (DataAnalystRole)
    events.append(make_event(
        "2026-02-02T09:19:00Z", "sts.amazonaws.com", "GetCallerIdentity",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
        response_elements={
            "userId": f"{PRINCIPAL_DATA_ANALYST_ROLE}:pentest-session",
            "account": ACCOUNT_ID,
            "arn": f"arn:aws:sts::{ACCOUNT_ID}:assumed-role/DataAnalystRole/pentest-session",
        },
    ))

    # 22. GetSecretValue tvault/evidence/password ★Stage 4 Q3
    events.append(make_event(
        "2026-02-02T09:19:11Z", "secretsmanager.amazonaws.com", "GetSecretValue",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"secretId": "tvault/evidence/password"},
        response_elements=None,
    ))

    # 23. DescribeInstances
    events.append(make_event(
        "2026-02-02T09:19:30Z", "ec2.amazonaws.com", "DescribeInstances",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"filterSet": {}, "instancesSet": {}},
    ))

    # 24. DescribeTags
    events.append(make_event(
        "2026-02-02T09:19:45Z", "ec2.amazonaws.com", "DescribeTags",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"filterSet": {}},
    ))

    # 25. ListFunctions
    events.append(make_event(
        "2026-02-02T09:20:00Z", "lambda.amazonaws.com", "ListFunctions20150331",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
    ))

    # 26. GetFunctionConfiguration techvault-data-processor
    events.append(make_event(
        "2026-02-02T09:20:15Z", "lambda.amazonaws.com", "GetFunctionConfiguration20150331v2",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"functionName": "techvault-data-processor"},
    ))

    # 27. GetParameter /techvault/db/password
    events.append(make_event(
        "2026-02-02T09:20:30Z", "ssm.amazonaws.com", "GetParameter",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"name": "/techvault/db/password", "withDecryption": True},
    ))

    # 28. GetParametersByPath /techvault/
    events.append(make_event(
        "2026-02-02T09:20:45Z", "ssm.amazonaws.com", "GetParametersByPath",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"path": "/techvault/", "recursive": True, "withDecryption": True},
    ))

    # 29. DescribeRepositories
    events.append(make_event(
        "2026-02-02T09:21:00Z", "ecr.amazonaws.com", "DescribeRepositories",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
    ))

    # 30. ListImages techvault/data-processor
    events.append(make_event(
        "2026-02-02T09:21:15Z", "ecr.amazonaws.com", "ListImages",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"repositoryName": "techvault/data-processor"},
    ))

    # 31. BatchGetImage techvault/data-processor
    events.append(make_event(
        "2026-02-02T09:21:30Z", "ecr.amazonaws.com", "BatchGetImage",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={
            "repositoryName": "techvault/data-processor",
            "imageIds": [{"imageTag": "latest"}],
        },
    ))

    # 32. InvokeModel (Bedrock)
    events.append(make_event(
        "2026-02-02T09:22:00Z", "bedrock.amazonaws.com", "InvokeModel",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"modelId": "jp.amazon.nova-2-lite-v1:0"},
        read_only=False,
    ))

    # 33. ListObjectsV2 techvault-cto-private-7a3f9c
    events.append(make_event(
        "2026-02-02T09:25:00Z", "s3.amazonaws.com", "ListObjectsV2",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"bucketName": "techvault-cto-private-7a3f9c", "prefix": "", "maxKeys": 1000},
    ))

    # 34. GetObject final_complicity.txt
    events.append(make_event(
        "2026-02-02T09:30:00Z", "s3.amazonaws.com", "GetObject",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={
            "bucketName": "techvault-cto-private-7a3f9c",
            "key": "cto-evidence/final_complicity.txt",
        },
    ))

    # 35. GetSecretValue tvault/cto/backup-key
    events.append(make_event(
        "2026-02-02T09:45:00Z", "secretsmanager.amazonaws.com", "GetSecretValue",
        da_identity, IP_ATTACKER, UA_AWS_CLI,
        request_params={"secretId": "tvault/cto/backup-key"},
    ))

    assert len(events) == 35, f"Attacker events: expected 35, got {len(events)}"
    return events


# ============================================================
# CTO イベント (23件)
# cto-kawakami (IAMUser)
# IP: 198.51.100.77
# 時間帯: 2026-02-01 13:30〜16:25 UTC
# JST: 2026-02-01 22:30〜2026-02-02 01:25
# ============================================================
def generate_cto_events():
    events = []
    cto_identity = make_iam_user_identity("cto-kawakami", PRINCIPAL_CTO, ACCESSKEY_CTO)

    # 1. ConsoleLogin
    events.append(make_event(
        "2026-02-01T13:30:00Z", "signin.amazonaws.com", "ConsoleLogin",
        cto_identity, IP_CTO, UA_CONSOLE_SIGNIN,
        request_params=None,
        response_elements={"ConsoleLogin": "Success"},
        read_only=False,
        event_type="AwsConsoleSignIn",
        event_category="Management",
    ))
    # Add additionalEventData for MFA
    events[-1]["additionalEventData"] = {"MFAUsed": "No", "LoginTo": "https://console.aws.amazon.com/console/home"}

    # 2. ListBuckets
    events.append(make_event(
        "2026-02-01T13:45:00Z", "s3.amazonaws.com", "ListBuckets",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
    ))

    # 3. GetBucketLocation
    events.append(make_event(
        "2026-02-01T13:50:00Z", "s3.amazonaws.com", "GetBucketLocation",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
        request_params={"bucketName": "techvault-internal-2026"},
    ))

    # 4. ListObjectsV2
    events.append(make_event(
        "2026-02-01T13:55:00Z", "s3.amazonaws.com", "ListObjectsV2",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
        request_params={"bucketName": "techvault-internal-2026", "prefix": "", "maxKeys": 300},
    ))

    # 5. GetObject encrypted_evidence.zip
    events.append(make_event(
        "2026-02-01T13:58:00Z", "s3.amazonaws.com", "GetObject",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
        request_params={
            "bucketName": "techvault-internal-2026",
            "key": "documents/encrypted_evidence.zip",
        },
    ))

    # 6. CreateBucket ★Stage 5 核心
    events.append(make_event(
        "2026-02-01T14:01:55Z", "s3.amazonaws.com", "CreateBucket",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
        request_params={
            "bucketName": "tvault-cto-private-7a3f9c",
            "CreateBucketConfiguration": {"LocationConstraint": REGION},
        },
        read_only=False,
    ))

    # 7. PutBucketVersioning
    events.append(make_event(
        "2026-02-01T14:02:30Z", "s3.amazonaws.com", "PutBucketVersioning",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
        request_params={
            "bucketName": "tvault-cto-private-7a3f9c",
            "VersioningConfiguration": {"Status": "Enabled"},
        },
        read_only=False,
    ))

    # 8. PutBucketEncryption
    events.append(make_event(
        "2026-02-01T14:03:00Z", "s3.amazonaws.com", "PutBucketEncryption",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
        request_params={
            "bucketName": "tvault-cto-private-7a3f9c",
            "ServerSideEncryptionConfiguration": {
                "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}],
            },
        },
        read_only=False,
    ))

    # 9. PutPublicAccessBlock
    events.append(make_event(
        "2026-02-01T14:04:00Z", "s3.amazonaws.com", "PutPublicAccessBlock",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
        request_params={
            "bucketName": "tvault-cto-private-7a3f9c",
            "PublicAccessBlockConfiguration": {
                "BlockPublicAcls": True,
                "IgnorePublicAcls": True,
                "BlockPublicPolicy": True,
                "RestrictPublicBuckets": True,
            },
        },
        read_only=False,
    ))

    # 10. PutObject wire_transfer_records.csv
    events.append(make_event(
        "2026-02-01T14:05:00Z", "s3.amazonaws.com", "PutObject",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
        request_params={
            "bucketName": "tvault-cto-private-7a3f9c",
            "key": "cto-evidence/wire_transfer_records.csv",
        },
        response_elements={
            "x-amz-id-2": "EXAMPLEID",
            "x-amz-request-id": gen_request_id(),
        },
        read_only=False,
    ))

    # 11. PutObject offshore_account.txt
    events.append(make_event(
        "2026-02-01T14:07:00Z", "s3.amazonaws.com", "PutObject",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
        request_params={
            "bucketName": "tvault-cto-private-7a3f9c",
            "key": "cto-evidence/offshore_account.txt",
        },
        response_elements={
            "x-amz-id-2": "EXAMPLEID",
            "x-amz-request-id": gen_request_id(),
        },
        read_only=False,
    ))

    # 12. PutBucketPolicy
    events.append(make_event(
        "2026-02-01T14:10:00Z", "s3.amazonaws.com", "PutBucketPolicy",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
        request_params={
            "bucketName": "tvault-cto-private-7a3f9c",
            "bucketPolicy": {
                "Version": "2012-10-17",
                "Statement": [{
                    "Sid": "DenyAllExceptCTO",
                    "Effect": "Deny",
                    "NotPrincipal": {"AWS": f"arn:aws:iam::{ACCOUNT_ID}:user/cto-kawakami"},
                    "Action": "s3:*",
                    "Resource": [
                        f"arn:aws:s3:::tvault-cto-private-7a3f9c",
                        f"arn:aws:s3:::tvault-cto-private-7a3f9c/*",
                    ],
                }],
            },
        },
        read_only=False,
    ))

    # 13. CreateSecret
    events.append(make_event(
        "2026-02-01T14:11:00Z", "secretsmanager.amazonaws.com", "CreateSecret",
        cto_identity, IP_CTO, UA_CONSOLE_MAC,
        request_params={
            "name": "tvault/cto/backup-key",
            "description": "Backup encryption key",
        },
        read_only=False,
    ))

    # 14. PutSecretValue
    events.append(make_event(
        "2026-02-01T14:12:00Z", "secretsmanager.amazonaws.com", "PutSecretValue",
        cto_identity, IP_CTO, UA_CONSOLE_MAC,
        request_params={"secretId": "tvault/cto/backup-key"},
        read_only=False,
    ))

    # 15. GetSecretValue
    events.append(make_event(
        "2026-02-01T14:15:00Z", "secretsmanager.amazonaws.com", "GetSecretValue",
        cto_identity, IP_CTO, UA_CONSOLE_MAC,
        request_params={"secretId": "tvault/cto/backup-key"},
    ))

    # 16. PutObject wire_transfer_records.csv update
    events.append(make_event(
        "2026-02-01T14:20:00Z", "s3.amazonaws.com", "PutObject",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
        request_params={
            "bucketName": "tvault-cto-private-7a3f9c",
            "key": "cto-evidence/wire_transfer_records.csv",
        },
        response_elements={
            "x-amz-id-2": "EXAMPLEID",
            "x-amz-request-id": gen_request_id(),
        },
        read_only=False,
    ))

    # 17. ListObjectsV2 (tvault-cto-private)
    events.append(make_event(
        "2026-02-01T14:30:00Z", "s3.amazonaws.com", "ListObjectsV2",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
        request_params={"bucketName": "tvault-cto-private-7a3f9c", "prefix": "", "maxKeys": 300},
    ))

    # 18. GetObject transfer_records
    events.append(make_event(
        "2026-02-01T14:35:00Z", "s3.amazonaws.com", "GetObject",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
        request_params={
            "bucketName": "tvault-cto-private-7a3f9c",
            "key": "cto-evidence/wire_transfer_records.csv",
        },
    ))

    # 19. DescribeTrails
    events.append(make_event(
        "2026-02-01T15:00:00Z", "cloudtrail.amazonaws.com", "DescribeTrails",
        cto_identity, IP_CTO, UA_CONSOLE_MAC,
    ))

    # 20. GetTrailStatus
    events.append(make_event(
        "2026-02-01T15:30:00Z", "cloudtrail.amazonaws.com", "GetTrailStatus",
        cto_identity, IP_CTO, UA_CONSOLE_MAC,
        request_params={"name": "techvault-trail"},
    ))

    # 21. GetSecretValue (backup-key) ★バックアップキー取得
    events.append(make_event(
        "2026-02-01T16:22:11Z", "secretsmanager.amazonaws.com", "GetSecretValue",
        cto_identity, IP_CTO, UA_CONSOLE_MAC,
        request_params={"secretId": "tvault/cto/backup-key"},
    ))

    # 22. PutObject final_complicity.txt ★自白メモ
    events.append(make_event(
        "2026-02-01T16:23:45Z", "s3.amazonaws.com", "PutObject",
        cto_identity, IP_CTO, UA_CONSOLE_S3,
        request_params={
            "bucketName": "tvault-cto-private-7a3f9c",
            "key": "cto-evidence/final_complicity.txt",
        },
        response_elements={
            "x-amz-id-2": "EXAMPLEID",
            "x-amz-request-id": gen_request_id(),
        },
        read_only=False,
    ))

    # 23. ConsoleLogout
    events.append(make_event(
        "2026-02-01T16:25:00Z", "signin.amazonaws.com", "ConsoleLogout",
        cto_identity, IP_CTO, UA_CONSOLE_SIGNIN,
        request_params=None,
        response_elements={"ConsoleLogout": "Success"},
        read_only=False,
        event_type="AwsConsoleSignIn",
    ))
    events[-1]["additionalEventData"] = {"MFAUsed": "No"}

    assert len(events) == 23, f"CTO events: expected 23, got {len(events)}"
    return events


# ============================================================
# ノイズ レイヤー A: ポータル利用者のアクション (60件)
# ============================================================
def generate_layer_a_events():
    events = []

    # --- Cognito 社員認証 (20件) ---
    cognito_times_morning = [
        "2026-02-01T00:02:00Z", "2026-02-01T00:05:30Z", "2026-02-01T00:08:15Z",
        "2026-02-01T00:12:00Z", "2026-02-01T00:18:00Z", "2026-02-01T00:25:00Z",
        "2026-02-01T00:35:00Z", "2026-02-01T00:50:00Z",
    ]
    cognito_times_afternoon = [
        "2026-02-01T02:10:00Z", "2026-02-01T02:45:00Z", "2026-02-01T03:20:00Z",
        "2026-02-01T03:55:00Z", "2026-02-01T04:15:00Z", "2026-02-01T04:50:00Z",
        "2026-02-01T05:25:00Z", "2026-02-01T05:55:00Z",
    ]
    cognito_times_next_morning = [
        "2026-02-02T00:05:00Z", "2026-02-02T00:20:00Z",
        "2026-02-02T00:40:00Z", "2026-02-02T00:55:00Z",
    ]
    all_cognito_times = cognito_times_morning + cognito_times_afternoon + cognito_times_next_morning

    cognito_events_names = [
        "AdminInitiateAuth", "AdminRespondToAuthChallenge",
        "GetUser", "AdminGetUser",
    ]

    lambda_cognito_identity = make_lambda_execution_identity("portal-auth")

    for i, t in enumerate(all_cognito_times):
        event_name = cognito_events_names[i % len(cognito_events_names)]
        user_pool_id = f"{REGION}_ExAmPlE01"
        events.append(make_event(
            t, "cognito-idp.amazonaws.com", event_name,
            lambda_cognito_identity, "AWS Internal", UA_LAMBDA,
            request_params={
                "userPoolId": user_pool_id,
                "clientId": "1example23456789abcdefghij",
            },
        ))

    # --- ポータル API 呼び出し (25件) ---
    portal_functions = (
        ["portal-auth"] * 8 + ["portal-chat"] * 10 +
        ["portal-config"] * 5 + ["portal-admin"] * 2
    )
    api_gw_identity = make_aws_service_identity("apigateway", "apigateway.amazonaws.com")
    api_times = []
    # Spread across the day
    base_hours = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 23, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
    for i, h in enumerate(base_hours):
        day = "01" if i < 11 else "02"
        minute = (i * 7 + 3) % 60
        api_times.append(f"2026-02-{day}T{h:02d}:{minute:02d}:00Z")

    for i, func_name in enumerate(portal_functions):
        events.append(make_event(
            api_times[i], "lambda.amazonaws.com", "Invoke",
            api_gw_identity, "apigateway.amazonaws.com", UA_APIGATEWAY,
            request_params={"functionName": func_name},
            read_only=False,
        ))

    # --- S3 フロントエンド配信 (10件) ---
    cf_identity = make_aws_service_identity("cloudfront", "cloudfront.amazonaws.com")
    frontend_files = [
        "index.html", "_next/static/chunks/main.js", "_next/static/css/app.css",
        "_next/static/media/logo.svg", "favicon.ico", "_next/static/chunks/webpack.js",
        "_next/static/chunks/pages/index.js", "manifest.json",
        "_next/static/chunks/framework.js", "robots.txt",
    ]
    cf_times = [
        "2026-02-01T00:15:00Z", "2026-02-01T00:15:01Z", "2026-02-01T00:15:02Z",
        "2026-02-01T00:15:03Z", "2026-02-01T01:30:00Z", "2026-02-01T03:00:00Z",
        "2026-02-01T05:00:00Z", "2026-02-01T07:00:00Z",
        "2026-02-02T00:10:00Z", "2026-02-02T02:00:00Z",
    ]

    for i, fname in enumerate(frontend_files):
        events.append(make_event(
            cf_times[i], "s3.amazonaws.com", "GetObject",
            cf_identity, "cloudfront.amazonaws.com", UA_CLOUDFRONT,
            request_params={"bucketName": "techvault-public-assets", "key": fname},
        ))

    # --- Bedrock チャット利用 (5件) ---
    bedrock_lambda_identity = make_lambda_execution_identity("portal-chat")
    bedrock_times = [
        "2026-02-01T02:30:00Z", "2026-02-01T04:00:00Z", "2026-02-01T05:30:00Z",
        "2026-02-01T07:15:00Z", "2026-02-02T01:00:00Z",
    ]
    for t in bedrock_times:
        events.append(make_event(
            t, "bedrock-runtime.amazonaws.com", "InvokeModel",
            bedrock_lambda_identity, "AWS Internal", UA_LAMBDA,
            request_params={"modelId": "jp.amazon.nova-2-lite-v1:0"},
            read_only=False,
        ))

    assert len(events) == 60, f"Layer A events: expected 60, got {len(events)}"
    return events


# ============================================================
# ノイズ レイヤー B-1: CTO 川上の日常インフラ管理 (12件)
# ============================================================
def generate_layer_b1_events():
    events = []
    cto_identity = make_iam_user_identity("cto-kawakami", PRINCIPAL_CTO, ACCESSKEY_CTO)

    b1_events = [
        ("2026-02-01T00:30:00Z", "signin.amazonaws.com", "ConsoleLogin", None, UA_CONSOLE_SIGNIN, False, "AwsConsoleSignIn"),
        ("2026-02-01T00:35:00Z", "ec2.amazonaws.com", "DescribeInstances", {"filterSet": {}, "instancesSet": {}}, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T00:40:00Z", "monitoring.amazonaws.com", "DescribeAlarms", None, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T01:00:00Z", "lambda.amazonaws.com", "ListFunctions20150331", None, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T01:15:00Z", "lambda.amazonaws.com", "GetFunctionConfiguration20150331v2", {"functionName": "portal-auth"}, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T01:20:00Z", "lambda.amazonaws.com", "UpdateFunctionConfiguration20150331v2", {"functionName": "portal-auth", "memorySize": 256}, UA_CONSOLE_MAC, False, "AwsApiCall"),
        ("2026-02-01T03:00:00Z", "cloudformation.amazonaws.com", "DescribeStacks", None, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T04:30:00Z", "monitoring.amazonaws.com", "GetMetricStatistics", {"namespace": "AWS/Lambda", "metricName": "Duration"}, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T05:00:00Z", "rds.amazonaws.com", "DescribeDBInstances", None, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T06:00:00Z", "s3.amazonaws.com", "ListBuckets", None, UA_CONSOLE_S3, True, "AwsApiCall"),
        ("2026-02-01T07:30:00Z", "cloudtrail.amazonaws.com", "DescribeTrails", None, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T08:00:00Z", "signin.amazonaws.com", "ConsoleLogin", None, UA_CONSOLE_SIGNIN, False, "AwsConsoleSignIn"),
    ]

    for t, source, name, params, ua, ro, et in b1_events:
        evt = make_event(t, source, name, cto_identity, IP_CTO, ua, request_params=params, read_only=ro, event_type=et)
        if name == "ConsoleLogin":
            evt["additionalEventData"] = {"MFAUsed": "No", "LoginTo": "https://console.aws.amazon.com/console/home"}
            evt["responseElements"] = {"ConsoleLogin": "Success"}
        events.append(evt)

    assert len(events) == 12, f"Layer B-1 events: expected 12, got {len(events)}"
    return events


# ============================================================
# ノイズ レイヤー B-2: svc-portal-dev の CI/CD デプロイ (15件)
# ============================================================
def generate_layer_b2_events():
    events = []
    svc_identity = make_iam_user_identity("svc-portal-dev", PRINCIPAL_SVC_PORTAL, ACCESSKEY_SVC_PORTAL)

    b2_events = [
        ("2026-02-01T02:15:00Z", "s3.amazonaws.com", "PutObject", {"bucketName": "techvault-public-assets", "key": "index.html"}, False),
        ("2026-02-01T02:15:10Z", "s3.amazonaws.com", "PutObject", {"bucketName": "techvault-public-assets", "key": "_next/static/chunks/main.js"}, False),
        ("2026-02-01T02:15:20Z", "s3.amazonaws.com", "PutObject", {"bucketName": "techvault-public-assets", "key": "_next/static/css/app.css"}, False),
        ("2026-02-01T02:15:30Z", "s3.amazonaws.com", "PutObject", {"bucketName": "techvault-public-assets", "key": "_next/static/media/logo.svg"}, False),
        ("2026-02-01T02:16:00Z", "s3.amazonaws.com", "DeleteObject", {"bucketName": "techvault-public-assets", "key": "_next/static/chunks/old-main.js"}, False),
        ("2026-02-01T02:17:00Z", "cloudfront.amazonaws.com", "CreateInvalidation", {"distributionId": "E1EXAMPLE", "invalidationBatch": {"paths": {"items": ["/*"], "quantity": 1}}}, False),
        ("2026-02-01T02:18:00Z", "cloudfront.amazonaws.com", "GetDistribution", {"id": "E1EXAMPLE"}, True),
        ("2026-02-01T06:30:00Z", "lambda.amazonaws.com", "UpdateFunctionCode20150331v2", {"functionName": "portal-chat", "s3Bucket": "techvault-deploy-artifacts", "s3Key": "portal-chat/latest.zip"}, False),
        ("2026-02-01T06:31:00Z", "lambda.amazonaws.com", "PublishVersion20150331", {"functionName": "portal-chat"}, False),
        ("2026-02-01T06:32:00Z", "lambda.amazonaws.com", "UpdateAlias20150331v2", {"functionName": "portal-chat", "name": "prod"}, False),
        ("2026-02-01T06:35:00Z", "lambda.amazonaws.com", "GetFunction20150331v2", {"functionName": "portal-chat"}, True),
        ("2026-02-01T06:40:00Z", "lambda.amazonaws.com", "Invoke", {"functionName": "portal-chat"}, False),
        ("2026-02-02T02:30:00Z", "s3.amazonaws.com", "PutObject", {"bucketName": "techvault-public-assets", "key": "index.html"}, False),
        ("2026-02-02T02:31:00Z", "s3.amazonaws.com", "PutObject", {"bucketName": "techvault-public-assets", "key": "_next/static/chunks/main-v2.js"}, False),
        ("2026-02-02T02:32:00Z", "cloudfront.amazonaws.com", "CreateInvalidation", {"distributionId": "E1EXAMPLE", "invalidationBatch": {"paths": {"items": ["/*"], "quantity": 1}}}, False),
    ]

    for t, source, name, params, ro in b2_events:
        events.append(make_event(
            t, source, name, svc_identity, IP_GITHUB_ACTIONS, UA_AWS_CLI_GITHUB,
            request_params=params, read_only=ro,
        ))

    assert len(events) == 15, f"Layer B-2 events: expected 15, got {len(events)}"
    return events


# ============================================================
# ノイズ レイヤー B-3: 開発者鈴木の Console 操作 (10件)
# ============================================================
def generate_layer_b3_events():
    events = []
    suzuki_identity = make_iam_user_identity("dev-suzuki", PRINCIPAL_DEV_SUZUKI, ACCESSKEY_DEV_SUZUKI)

    b3_events = [
        ("2026-02-01T01:00:00Z", "signin.amazonaws.com", "ConsoleLogin", None, UA_CONSOLE_SIGNIN, False, "AwsConsoleSignIn"),
        ("2026-02-01T01:30:00Z", "logs.amazonaws.com", "DescribeLogGroups", None, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T01:35:00Z", "logs.amazonaws.com", "FilterLogEvents", {"logGroupName": "/aws/lambda/portal-auth"}, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T01:40:00Z", "logs.amazonaws.com", "FilterLogEvents", {"logGroupName": "/aws/lambda/portal-chat"}, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T02:00:00Z", "lambda.amazonaws.com", "GetFunctionConfiguration20150331v2", {"functionName": "portal-auth"}, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T03:30:00Z", "apigateway.amazonaws.com", "TestInvokeMethod", {"restApiId": "abc123", "resourceId": "def456", "httpMethod": "POST"}, UA_CONSOLE_MAC, False, "AwsApiCall"),
        ("2026-02-01T04:00:00Z", "apigateway.amazonaws.com", "GetRestApis", None, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T05:30:00Z", "cognito-idp.amazonaws.com", "DescribeUserPool", {"userPoolId": f"{REGION}_ExAmPlE01"}, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T06:00:00Z", "cognito-idp.amazonaws.com", "ListUsers", {"userPoolId": f"{REGION}_ExAmPlE01"}, UA_CONSOLE_MAC, True, "AwsApiCall"),
        ("2026-02-01T08:30:00Z", "ssm.amazonaws.com", "GetParameter", {"name": "/techvault/config/region", "withDecryption": False}, UA_CONSOLE_MAC, True, "AwsApiCall"),
    ]

    for t, source, name, params, ua, ro, et in b3_events:
        evt = make_event(t, source, name, suzuki_identity, IP_DEV_SUZUKI, ua, request_params=params, read_only=ro, event_type=et)
        if name == "ConsoleLogin":
            evt["additionalEventData"] = {"MFAUsed": "Yes", "LoginTo": "https://console.aws.amazon.com/console/home"}
            evt["responseElements"] = {"ConsoleLogin": "Success"}
        events.append(evt)

    assert len(events) == 10, f"Layer B-3 events: expected 10, got {len(events)}"
    return events


# ============================================================
# ノイズ レイヤー B-4: ECR/Docker 操作 (6件)
# ============================================================
def generate_layer_b4_events():
    events = []
    svc_identity = make_iam_user_identity("svc-portal-dev", PRINCIPAL_SVC_PORTAL, ACCESSKEY_SVC_PORTAL)

    b4_events = [
        ("2026-02-01T03:00:00Z", "ecr.amazonaws.com", "GetAuthorizationToken", None, True),
        ("2026-02-01T03:01:00Z", "ecr.amazonaws.com", "InitiateLayerUpload", {"repositoryName": "techvault/data-processor"}, False),
        ("2026-02-01T03:03:00Z", "ecr.amazonaws.com", "CompleteLayerUpload", {"repositoryName": "techvault/data-processor"}, False),
        ("2026-02-01T03:04:00Z", "ecr.amazonaws.com", "PutImage", {"repositoryName": "techvault/data-processor", "imageTag": "latest"}, False),
        ("2026-02-01T03:05:00Z", "ecr.amazonaws.com", "DescribeImages", {"repositoryName": "techvault/data-processor"}, True),
        ("2026-02-01T03:10:00Z", "ecr.amazonaws.com", "BatchGetImage", {"repositoryName": "techvault/data-processor", "imageIds": [{"imageTag": "latest"}]}, True),
    ]

    for t, source, name, params, ro in b4_events:
        events.append(make_event(
            t, source, name, svc_identity, IP_GITHUB_ACTIONS, UA_AWS_CLI_GITHUB,
            request_params=params, read_only=ro,
        ))

    assert len(events) == 6, f"Layer B-4 events: expected 6, got {len(events)}"
    return events


# ============================================================
# ノイズ レイヤー C: AWS 基盤自動オペレーション (86件)
# ============================================================
def generate_layer_c_events():
    events = []

    # --- CloudWatch メトリクス (18件): 5分ごとに散布 ---
    cw_identity = make_aws_service_identity("monitoring", "monitoring.amazonaws.com")
    cw_names = ["PutMetricData", "DescribeAlarms"]
    for i in range(18):
        # Spread across 2026-02-01 00:00 to 2026-02-02 09:00
        hour = (i * 2) % 24
        day = "01" if i < 12 else "02"
        minute = (i * 5) % 60
        t = f"2026-02-{day}T{hour:02d}:{minute:02d}:00Z"
        events.append(make_event(
            t, "monitoring.amazonaws.com", cw_names[i % 2],
            cw_identity, "monitoring.amazonaws.com", UA_AWS_INTERNAL,
            request_params={"namespace": "AWS/Lambda"} if cw_names[i % 2] == "PutMetricData" else None,
        ))

    # --- CloudTrail 自己 (6件): 1時間ごと ---
    ct_identity = make_aws_service_identity("cloudtrail", "cloudtrail.amazonaws.com")
    ct_events_list = ["LookupEvents", "GetTrailStatus"]
    for i in range(6):
        hour = i * 4
        day = "01" if hour < 24 else "02"
        if hour >= 24:
            hour -= 24
        t = f"2026-02-{day}T{hour:02d}:00:00Z"
        events.append(make_event(
            t, "cloudtrail.amazonaws.com", ct_events_list[i % 2],
            ct_identity, "cloudtrail.amazonaws.com", UA_AWS_INTERNAL,
            request_params={"trailName": "techvault-trail"} if ct_events_list[i % 2] == "GetTrailStatus" else None,
        ))

    # --- AWS Config (6件) ---
    config_identity = make_aws_service_identity("config", "config.amazonaws.com")
    config_events = [
        ("2026-02-01T00:00:30Z", "PutConfigRule"),
        ("2026-02-01T04:00:30Z", "PutEvaluations"),
        ("2026-02-01T08:00:30Z", "DeliverConfigSnapshot"),
        ("2026-02-01T12:00:30Z", "PutConfigRule"),
        ("2026-02-01T16:00:30Z", "PutEvaluations"),
        ("2026-02-01T20:00:30Z", "DeliverConfigSnapshot"),
    ]
    for t, name in config_events:
        events.append(make_event(
            t, "config.amazonaws.com", name,
            config_identity, "config.amazonaws.com", UA_AWS_INTERNAL,
            read_only=False,
        ))

    # --- IAM 監査 (5件) ---
    iam_identity = make_aws_service_identity("iam", "iam.amazonaws.com")
    iam_events = [
        ("2026-02-01T01:00:30Z", "GenerateCredentialReport"),
        ("2026-02-01T05:00:30Z", "GetCredentialReport"),
        ("2026-02-01T09:00:30Z", "GenerateCredentialReport"),
        ("2026-02-01T13:00:30Z", "GetCredentialReport"),
        ("2026-02-01T17:00:30Z", "GenerateCredentialReport"),
    ]
    for t, name in iam_events:
        ro = name == "GetCredentialReport"
        events.append(make_event(
            t, "iam.amazonaws.com", name,
            iam_identity, "iam.amazonaws.com", UA_AWS_INTERNAL,
            read_only=ro,
        ))

    # --- KMS 暗号化 (10件) ---
    kms_identity = make_aws_service_identity("kms", "kms.amazonaws.com")
    kms_events_data = [
        ("2026-02-01T00:10:00Z", "Decrypt"),
        ("2026-02-01T01:10:00Z", "GenerateDataKey"),
        ("2026-02-01T02:10:00Z", "Decrypt"),
        ("2026-02-01T03:10:00Z", "Decrypt"),
        ("2026-02-01T04:10:00Z", "GenerateDataKey"),
        ("2026-02-01T06:10:00Z", "Decrypt"),
        ("2026-02-01T08:10:00Z", "GenerateDataKey"),
        ("2026-02-01T10:10:00Z", "Decrypt"),
        ("2026-02-01T14:10:00Z", "GenerateDataKey"),
        ("2026-02-01T18:10:00Z", "Decrypt"),
    ]
    for t, name in kms_events_data:
        events.append(make_event(
            t, "kms.amazonaws.com", name,
            kms_identity, "kms.amazonaws.com", UA_AWS_INTERNAL,
            request_params={"keyId": f"arn:aws:kms:{REGION}:{ACCOUNT_ID}:key/mrk-example123"},
        ))

    # --- EC2 ヘルスチェック (6件) ---
    ec2_identity = make_aws_service_identity("ec2", "ec2.amazonaws.com")
    ec2_events = [
        ("2026-02-01T00:20:00Z", "DescribeInstanceStatus"),
        ("2026-02-01T04:20:00Z", "DescribeVpcs"),
        ("2026-02-01T08:20:00Z", "DescribeInstanceStatus"),
        ("2026-02-01T12:20:00Z", "DescribeVpcs"),
        ("2026-02-01T16:20:00Z", "DescribeInstanceStatus"),
        ("2026-02-01T20:20:00Z", "DescribeVpcs"),
    ]
    for t, name in ec2_events:
        events.append(make_event(
            t, "ec2.amazonaws.com", name,
            ec2_identity, "ec2.amazonaws.com", UA_AWS_INTERNAL,
        ))

    # --- SSM エージェント (5件) ---
    ssm_identity = make_assumed_role_identity("EC2InstanceRole", "i-0abc123def456789", PRINCIPAL_EC2_ROLE)
    ssm_events = [
        ("2026-02-01T00:30:30Z", "UpdateInstanceInformation"),
        ("2026-02-01T04:30:30Z", "ListAssociations"),
        ("2026-02-01T08:30:30Z", "UpdateInstanceInformation"),
        ("2026-02-01T12:30:30Z", "ListAssociations"),
        ("2026-02-01T16:30:30Z", "UpdateInstanceInformation"),
    ]
    for t, name in ssm_events:
        ro = name == "ListAssociations"
        events.append(make_event(
            t, "ssm.amazonaws.com", name,
            ssm_identity, "203.0.113.100", UA_AWS_INTERNAL,
            request_params={"instanceId": "i-0abc123def456789"} if name == "UpdateInstanceInformation" else None,
            read_only=ro,
        ))

    # --- SNS 通知 (4件) ---
    sns_identity = make_aws_service_identity("sns", "sns.amazonaws.com")
    sns_events = [
        ("2026-02-01T01:45:00Z", "Publish"),
        ("2026-02-01T05:45:00Z", "Publish"),
        ("2026-02-01T09:45:00Z", "Publish"),
        ("2026-02-01T13:45:00Z", "Publish"),
    ]
    for t, name in sns_events:
        events.append(make_event(
            t, "sns.amazonaws.com", name,
            sns_identity, "sns.amazonaws.com", UA_AWS_INTERNAL,
            request_params={"topicArn": f"arn:aws:sns:{REGION}:{ACCOUNT_ID}:techvault-alerts"},
            read_only=False,
        ))

    # --- STS トークンリフレッシュ (5件) ---
    sts_identity = make_aws_service_identity("lambda", "lambda.amazonaws.com")
    sts_events = [
        ("2026-02-01T00:45:00Z", "AssumeRole", {"roleArn": f"arn:aws:iam::{ACCOUNT_ID}:role/portal-lambda-role", "roleSessionName": "portal-auth"}),
        ("2026-02-01T04:45:00Z", "GetSessionToken", None),
        ("2026-02-01T08:45:00Z", "AssumeRole", {"roleArn": f"arn:aws:iam::{ACCOUNT_ID}:role/portal-lambda-role", "roleSessionName": "portal-chat"}),
        ("2026-02-01T12:45:00Z", "GetSessionToken", None),
        ("2026-02-01T16:45:00Z", "AssumeRole", {"roleArn": f"arn:aws:iam::{ACCOUNT_ID}:role/portal-lambda-role", "roleSessionName": "portal-config"}),
    ]
    for t, name, params in sts_events:
        events.append(make_event(
            t, "sts.amazonaws.com", name,
            sts_identity, "lambda.amazonaws.com", UA_LAMBDA,
            request_params=params,
            read_only=False,
        ))

    # --- RDS 自動バックアップ (4件) ---
    rds_identity = make_aws_service_identity("rds", "rds.amazonaws.com")
    rds_events = [
        ("2026-02-01T02:00:30Z", "CreateDBSnapshot", {"dBSnapshotIdentifier": "rds:techvault-db-2026-02-01-02-00", "dBInstanceIdentifier": "techvault-db"}),
        ("2026-02-01T06:00:30Z", "ModifyDBInstance", {"dBInstanceIdentifier": "techvault-db"}),
        ("2026-02-01T14:00:30Z", "CreateDBSnapshot", {"dBSnapshotIdentifier": "rds:techvault-db-2026-02-01-14-00", "dBInstanceIdentifier": "techvault-db"}),
        ("2026-02-01T18:00:30Z", "ModifyDBInstance", {"dBInstanceIdentifier": "techvault-db"}),
    ]
    for t, name, params in rds_events:
        events.append(make_event(
            t, "rds.amazonaws.com", name,
            rds_identity, "rds.amazonaws.com", UA_AWS_INTERNAL,
            request_params=params,
            read_only=False,
        ))

    # --- Bedrock 利用ログ (4件) ---
    bedrock_svc_identity = make_aws_service_identity("bedrock", "bedrock.amazonaws.com")
    bedrock_times = [
        "2026-02-01T03:15:00Z", "2026-02-01T07:15:00Z",
        "2026-02-01T11:15:00Z", "2026-02-01T15:15:00Z",
    ]
    for t in bedrock_times:
        events.append(make_event(
            t, "bedrock.amazonaws.com", "InvokeModel",
            bedrock_svc_identity, "bedrock.amazonaws.com", UA_AWS_INTERNAL,
            request_params={"modelId": "jp.amazon.nova-2-lite-v1:0"},
            read_only=False,
        ))

    # --- CloudFormation (3件) ---
    cfn_identity = make_aws_service_identity("cloudformation", "cloudformation.amazonaws.com")
    cfn_events = [
        ("2026-02-01T02:30:30Z", "DescribeStacks"),
        ("2026-02-01T06:30:30Z", "ListStackResources"),
        ("2026-02-01T10:30:30Z", "DescribeStacks"),
    ]
    for t, name in cfn_events:
        events.append(make_event(
            t, "cloudformation.amazonaws.com", name,
            cfn_identity, "cloudformation.amazonaws.com", UA_AWS_INTERNAL,
        ))

    # --- CloudWatch Logs (10件) ---
    logs_identity = make_lambda_execution_identity("portal-auth")
    log_groups = [
        "/aws/lambda/portal-auth", "/aws/lambda/portal-chat",
        "/aws/lambda/portal-config", "/aws/lambda/portal-admin",
        "/aws/lambda/techvault-data-processor",
    ]
    logs_events_data = []
    for i in range(10):
        hour = (i * 2 + 1) % 24
        day = "01" if i < 8 else "02"
        t = f"2026-02-{day}T{hour:02d}:00:30Z"
        name = "CreateLogStream" if i % 2 == 0 else "PutLogEvents"
        lg = log_groups[i % len(log_groups)]
        logs_events_data.append((t, name, lg))

    for t, name, lg in logs_events_data:
        events.append(make_event(
            t, "logs.amazonaws.com", name,
            logs_identity, "AWS Internal", UA_LAMBDA,
            request_params={"logGroupName": lg},
            read_only=False,
        ))

    assert len(events) == 86, f"Layer C events: expected 86, got {len(events)}"
    return events


# ============================================================
# ノイズ レイヤー D: 追加の通常業務・監査ノイズ (180件)
# ============================================================
def generate_layer_d_events():
    events = []

    business_users = [
        ("finance-sato", "AIDAEXAMPLEFINANCE1", "198.51.100.21"),
        ("support-yamada", "AIDAEXAMPLESUPPORT1", "198.51.100.22"),
        ("analyst-tanaka", "AIDAEXAMPLEANALYST1", "198.51.100.23"),
        ("qa-nakamura", "AIDAEXAMPLEQA00001", "198.51.100.24"),
    ]
    business_actions = [
        ("s3.amazonaws.com", "ListObjectsV2", {"bucketName": "techvault-public-assets", "prefix": "reports/"}),
        ("s3.amazonaws.com", "GetObject", {"bucketName": "techvault-public-assets", "key": "reports/daily-summary.csv"}),
        ("logs.amazonaws.com", "DescribeLogGroups", None),
        ("logs.amazonaws.com", "FilterLogEvents", {"logGroupName": "/aws/lambda/portal-chat"}),
        ("monitoring.amazonaws.com", "GetMetricData", {"metricDataQueries": []}),
        ("cognito-idp.amazonaws.com", "AdminGetUser", {"userPoolId": f"{REGION}_ExAmPlE01", "username": "employee@example.com"}),
        ("lambda.amazonaws.com", "GetFunctionConfiguration20150331v2", {"functionName": "portal-chat"}),
        ("athena.amazonaws.com", "StartQueryExecution", {"queryString": "SELECT count(*) FROM audit_events"}),
    ]
    for i in range(64):
        username, principal_id, ip = business_users[i % len(business_users)]
        source, name, params = business_actions[i % len(business_actions)]
        day = "01" if i < 32 else "02"
        hour = 1 + ((i * 3) % 19)
        minute = (i * 7) % 60
        second = (i * 11) % 60
        identity = make_iam_user_identity(username, principal_id)
        events.append(make_event(
            f"2026-02-{day}T{hour:02d}:{minute:02d}:{second:02d}Z",
            source, name, identity, ip, UA_CONSOLE_MAC,
            request_params=params,
            read_only=name != "StartQueryExecution",
        ))

    svc_identity = make_iam_user_identity("svc-portal-dev", PRINCIPAL_SVC_PORTAL, ACCESSKEY_SVC_PORTAL)
    deploy_actions = [
        ("s3.amazonaws.com", "PutObject", {"bucketName": "techvault-deploy-artifacts", "key": "frontend/build.tar.gz"}, False),
        ("s3.amazonaws.com", "GetObject", {"bucketName": "techvault-deploy-artifacts", "key": "frontend/build.tar.gz"}, True),
        ("lambda.amazonaws.com", "UpdateFunctionConfiguration20150331v2", {"functionName": "portal-admin"}, False),
        ("lambda.amazonaws.com", "GetFunction20150331v2", {"functionName": "portal-admin"}, True),
        ("apigateway.amazonaws.com", "GET", {"restApiId": "abc123", "resourceId": "def456"}, True),
        ("cloudfront.amazonaws.com", "GetInvalidation", {"distributionId": "E1EXAMPLE", "id": "IEXAMPLE"}, True),
    ]
    for i in range(36):
        source, name, params, ro = deploy_actions[i % len(deploy_actions)]
        day = "01" if i < 18 else "02"
        hour = 2 + ((i * 2) % 17)
        minute = (i * 13) % 60
        events.append(make_event(
            f"2026-02-{day}T{hour:02d}:{minute:02d}:30Z",
            source, name, svc_identity, IP_GITHUB_ACTIONS, UA_AWS_CLI_GITHUB,
            request_params=params,
            read_only=ro,
        ))

    service_actions = [
        ("guardduty.amazonaws.com", "GetFindingsStatistics", "guardduty"),
        ("guardduty.amazonaws.com", "ListFindings", "guardduty"),
        ("securityhub.amazonaws.com", "BatchImportFindings", "securityhub"),
        ("securityhub.amazonaws.com", "GetFindings", "securityhub"),
        ("config.amazonaws.com", "SelectResourceConfig", "config"),
        ("config.amazonaws.com", "GetComplianceDetailsByConfigRule", "config"),
        ("kms.amazonaws.com", "Decrypt", "kms"),
        ("kms.amazonaws.com", "GenerateDataKey", "kms"),
        ("monitoring.amazonaws.com", "PutMetricData", "monitoring"),
        ("events.amazonaws.com", "PutEvents", "events"),
    ]
    for i in range(50):
        source, name, service = service_actions[i % len(service_actions)]
        day = "01" if i < 25 else "02"
        hour = (i * 5) % 24
        minute = (i * 17) % 60
        identity = make_aws_service_identity(service, source)
        params = {"namespace": "TechVault/Security"} if name == "PutMetricData" else None
        events.append(make_event(
            f"2026-02-{day}T{hour:02d}:{minute:02d}:45Z",
            source, name, identity, source, UA_AWS_INTERNAL,
            request_params=params,
            read_only=name not in {"BatchImportFindings", "GenerateDataKey", "PutMetricData", "PutEvents"},
        ))

    batch_roles = [
        ("DataExportRole", "AROAEXAMPLEDATAEXP1", "daily-export"),
        ("BackupJobRole", "AROAEXAMPLEBACKUP01", "nightly-backup"),
        ("InventoryReportRole", "AROAEXAMPLEINVREP1", "inventory-report"),
    ]
    batch_actions = [
        ("s3.amazonaws.com", "ListObjectsV2", {"bucketName": "techvault-analytics", "prefix": "exports/"}),
        ("s3.amazonaws.com", "PutObject", {"bucketName": "techvault-analytics", "key": "exports/daily.csv"}),
        ("rds.amazonaws.com", "DescribeDBSnapshots", {"dBInstanceIdentifier": "techvault-db"}),
        ("logs.amazonaws.com", "CreateExportTask", {"logGroupName": "/aws/lambda/portal-admin"}),
        ("sts.amazonaws.com", "GetCallerIdentity", None),
    ]
    for i in range(30):
        role_name, principal_id, session_name = batch_roles[i % len(batch_roles)]
        source, name, params = batch_actions[i % len(batch_actions)]
        day = "01" if i < 15 else "02"
        hour = (i * 4) % 24
        minute = (i * 19) % 60
        identity = make_assumed_role_identity(role_name, session_name, principal_id)
        events.append(make_event(
            f"2026-02-{day}T{hour:02d}:{minute:02d}:15Z",
            source, name, identity, "AWS Internal", UA_AWS_INTERNAL,
            request_params=params,
            read_only=name not in {"PutObject", "CreateExportTask"},
        ))

    assert len(events) == 180, f"Layer D events: expected 180, got {len(events)}"
    return events


def main():
    all_events = []

    attacker = generate_attacker_events()
    cto = generate_cto_events()
    layer_a = generate_layer_a_events()
    layer_b1 = generate_layer_b1_events()
    layer_b2 = generate_layer_b2_events()
    layer_b3 = generate_layer_b3_events()
    layer_b4 = generate_layer_b4_events()
    layer_c = generate_layer_c_events()
    layer_d = generate_layer_d_events()

    all_events.extend(attacker)
    all_events.extend(cto)
    all_events.extend(layer_a)
    all_events.extend(layer_b1)
    all_events.extend(layer_b2)
    all_events.extend(layer_b3)
    all_events.extend(layer_b4)
    all_events.extend(layer_c)
    all_events.extend(layer_d)

    # イベント数の検証
    counts = {
        "attacker": len(attacker),
        "cto": len(cto),
        "layer_a": len(layer_a),
        "layer_b1": len(layer_b1),
        "layer_b2": len(layer_b2),
        "layer_b3": len(layer_b3),
        "layer_b4": len(layer_b4),
        "layer_c": len(layer_c),
        "layer_d": len(layer_d),
    }
    total = sum(counts.values())
    print(f"Event counts: {json.dumps(counts, indent=2)}")
    print(f"Total events: {total}")
    assert total == 427, f"Total events must be 427, got {total}"

    # eventTime の昇順でソート
    all_events.sort(key=lambda e: e["eventTime"])

    output = {"Records": all_events}

    output_path = Path(__file__).parent / "cloudtrail-logs.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    legacy_gzip_path = Path(__file__).parent / "cloudtrail-logs.json.gz"
    with gzip.open(legacy_gzip_path, "wt", encoding="utf-8") as f:
        json.dump(output, f, separators=(",", ":"), ensure_ascii=False)

    stage4_zip_path = Path(__file__).parent / "cloudtrail-logs.zip"
    with zipfile.ZipFile(stage4_zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(output_path, arcname="cloudtrail-logs.json")

    cloudtrail_path = Path(__file__).parent / "cloudtrail" / CLOUDTRAIL_OBJECT_KEY
    cloudtrail_path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(cloudtrail_path, "wt", encoding="utf-8") as f:
        json.dump(output, f, separators=(",", ":"), ensure_ascii=False)

    print(f"Generated {len(all_events)} events -> {output_path}")
    print(f"Generated gzip bundle -> {legacy_gzip_path}")
    print(f"Generated Stage 4 zip -> {stage4_zip_path}")
    print(f"Generated CloudTrail object -> {cloudtrail_path}")


if __name__ == "__main__":
    main()
