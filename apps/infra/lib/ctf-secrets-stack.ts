import * as cdk from 'aws-cdk-lib'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as iam from 'aws-cdk-lib/aws-iam'
import type { Construct } from 'constructs'
import { CTO_BACKUP_KEY_VALUE, EVIDENCE_SECRET_VALUE } from './challenge-secrets'
import { getChallengeSecretNames, getIamUserNames, getTechVaultParameterNames } from './stage-names'

interface CtfSecretsStackProps extends cdk.StackProps {
  stage: string
}

export class CtfSecretsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CtfSecretsStackProps) {
    super(scope, id, props)
    const secretNames = getChallengeSecretNames(props.stage)
    const iamUserNames = getIamUserNames(props.stage)
    const parameterNames = getTechVaultParameterNames(props.stage)

    // === Secrets Manager ===

    // tvault/evidence/password — Stage 3A フラグ + Final 復号パスワード
    const evidenceSecret = new secretsmanager.Secret(this, 'EvidencePassword', {
      secretName: secretNames.evidencePassword,
      description: 'Evidence archive password',
      secretStringValue: cdk.SecretValue.unsafePlainText(EVIDENCE_SECRET_VALUE),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // リソースポリシー: DataAnalystRole からアクセス可能
    evidenceSecret.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowDataAnalyst',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ArnPrincipal(`arn:aws:iam::${this.account}:role/DataAnalystRole-${props.stage}`)],
        actions: ['secretsmanager:GetSecretValue'],
        resources: [evidenceSecret.secretArn],
      }),
    )

    // tvault/internal/db — アクセス拒否デコイ
    const dbSecret = new secretsmanager.Secret(this, 'InternalDb', {
      secretName: secretNames.internalDb,
      description: 'RDS master credentials',
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({
          host: 'internal-db.techvault.local',
          port: 5432,
          dbname: 'techvault_analytics',
          username: 'master',
          password: 'SuperSecretDbPassword2026!',
        }),
      ),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // Lambda-processor のみアクセス可能、他は Deny
    dbSecret.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowLambdaOnly',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ArnPrincipal(`arn:aws:iam::${this.account}:role/LambdaExecutionRole-processor-${props.stage}`)],
        actions: ['secretsmanager:GetSecretValue'],
        resources: [dbSecret.secretArn],
      }),
    )
    dbSecret.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyOthers',
        effect: iam.Effect.DENY,
        principals: [new iam.StarPrincipal()],
        actions: ['secretsmanager:GetSecretValue'],
        resources: [dbSecret.secretArn],
        conditions: {
          'ArnNotLike': {
            'aws:PrincipalArn': [
              `arn:aws:iam::${this.account}:role/LambdaExecutionRole-processor-${props.stage}`,
              `arn:aws:iam::${this.account}:role/cdk-hnb659fds-cfn-exec-role-${this.account}-${this.region}`,
              `arn:aws:sts::${this.account}:assumed-role/cdk-hnb659fds-cfn-exec-role-${this.account}-${this.region}/*`,
            ],
          },
        },
      }),
    )

    // tvault/cto/backup-key — 設定ミスで DataAnalystRole からもアクセス可能
    const ctoBackupKey = new secretsmanager.Secret(this, 'CtoBackupKey', {
      secretName: secretNames.ctoBackupKey,
      description: 'CTO backup encryption key',
      secretStringValue: cdk.SecretValue.unsafePlainText(CTO_BACKUP_KEY_VALUE),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    ctoBackupKey.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCTOOnly',
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.ArnPrincipal(`arn:aws:iam::${this.account}:user/${iamUserNames.ctoKawakami}`),
          // 意図的な設定ミス: DataAnalystRole にもアクセスを許可
          new iam.ArnPrincipal(`arn:aws:iam::${this.account}:role/DataAnalystRole-${props.stage}`),
        ],
        actions: ['secretsmanager:GetSecretValue'],
        resources: [ctoBackupKey.secretArn],
      }),
    )

    // === SSM Parameter Store ===

    // /techvault/internal/api-key — Stage 2E フラグ
    new ssm.StringParameter(this, 'InternalApiKey', {
      parameterName: parameterNames.internalApiKey,
      description: 'Internal API key (SecureString)',
      stringValue: 'sk-tvault-TVAULT{ssm_secure_string_exposed}',
      tier: ssm.ParameterTier.STANDARD,
      // CDK の StringParameter は SecureString をネイティブサポートしないが
      // 値自体は配置される。実際の SecureString は CfnParameter で作成
    })

    // /techvault/internal/db-password — デコイ
    new ssm.StringParameter(this, 'InternalDbPassword', {
      parameterName: parameterNames.internalDbPassword,
      description: 'Internal DB password (decoy - access denied)',
      stringValue: 'DECOY-ACCESS-DENIED',
      tier: ssm.ParameterTier.STANDARD,
    })

    // /techvault/config/region — 非機密設定値
    new ssm.StringParameter(this, 'ConfigRegion', {
      parameterName: parameterNames.configRegion,
      description: 'Default AWS region',
      stringValue: 'ap-northeast-1',
      tier: ssm.ParameterTier.STANDARD,
    })
  }
}
