import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import type { Construct } from 'constructs'
import { getIamUserNames } from './stage-names'

interface CtfIamStackProps extends cdk.StackProps {
  stage: string
}

export class CtfIamStack extends cdk.Stack {
  public readonly svcPortalDev: iam.User
  public readonly ctoKawakami: iam.User
  public readonly ctoKawakamiAccessKey: iam.AccessKey
  public readonly svcWebBackend: iam.User
  public readonly dataAnalystRole: iam.Role
  public readonly ec2InstanceRole: iam.Role
  public readonly ec2InstanceProfile: iam.InstanceProfile
  public readonly lambdaPortalRole: iam.Role
  public readonly lambdaProcessorRole: iam.Role

  constructor(scope: Construct, id: string, props: CtfIamStackProps) {
    super(scope, id, props)
    const iamUserNames = getIamUserNames(props.stage)

    // === IAM Users ===

    // svc-portal-dev: Stage 0 で漏洩するクレデンシャルの持ち主
    this.svcPortalDev = new iam.User(this, 'SvcPortalDev', {
      userName: iamUserNames.svcPortalDev,
    })
    cdk.Tags.of(this.svcPortalDev).add('Service', 'TechVaultPortal')
    cdk.Tags.of(this.svcPortalDev).add('Environment', props.stage)
    const svcPortalDevArn = `arn:aws:iam::${this.account}:user/${iamUserNames.svcPortalDev}`

    const portalDevPolicy = new iam.ManagedPolicy(this, 'PortalDevPolicy', {
      managedPolicyName: `PortalDevPolicy-${props.stage}`,
      description: 'TVAULT{iam_user_recon_complete}',
      statements: [
        new iam.PolicyStatement({
          sid: 'S3InternalBucketAccess',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:ListBucket',
            's3:GetBucketVersioning',
            's3:ListBucketVersions',
            's3:GetObjectVersion',
          ],
          resources: [
            `arn:aws:s3:::techvault-internal-2026-${props.stage}`,
            `arn:aws:s3:::techvault-internal-2026-${props.stage}/*`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'S3BucketDiscovery',
          effect: iam.Effect.ALLOW,
          actions: ['s3:ListAllMyBuckets'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'StsIdentityCheck',
          effect: iam.Effect.ALLOW,
          actions: ['sts:GetCallerIdentity'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'IamSelfUserInspection',
          effect: iam.Effect.ALLOW,
          actions: ['iam:GetUser', 'iam:ListAttachedUserPolicies', 'iam:ListUserTags'],
          resources: [svcPortalDevArn],
        }),
        new iam.PolicyStatement({
          sid: 'IamPortalPolicyInspection',
          effect: iam.Effect.ALLOW,
          actions: ['iam:GetPolicy', 'iam:GetPolicyVersion'],
          resources: [`arn:aws:iam::${this.account}:policy/PortalDevPolicy-${props.stage}`],
        }),
        new iam.PolicyStatement({
          sid: 'IamDataAnalystRoleInspection',
          effect: iam.Effect.ALLOW,
          actions: ['iam:GetRole'],
          resources: [`arn:aws:iam::${this.account}:role/DataAnalystRole-${props.stage}`],
        }),
        new iam.PolicyStatement({
          sid: 'AssumeDataAnalystRole',
          effect: iam.Effect.ALLOW,
          actions: ['sts:AssumeRole'],
          resources: [`arn:aws:iam::${this.account}:role/DataAnalystRole-${props.stage}`],
        }),
      ],
    })
    this.svcPortalDev.addManagedPolicy(portalDevPolicy)

    // cto-kawakami: CTO のオペレーション用 (MFA 未設定)
    this.ctoKawakami = new iam.User(this, 'CtoKawakami', {
      userName: iamUserNames.ctoKawakami,
    })
    const ctoEmergencyPolicy = new iam.Policy(this, 'CtoEmergencyPolicy', {
      policyName: `CtoEmergencyPolicy-${props.stage}`,
      statements: [
        new iam.PolicyStatement({
          sid: 'EmergencySecretsAccess',
          effect: iam.Effect.ALLOW,
          actions: ['secretsmanager:GetSecretValue'],
          resources: [
            `arn:aws:secretsmanager:ap-northeast-1:${this.account}:secret:tvault/cto/backup-key-*`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'EmergencySecretDiscovery',
          effect: iam.Effect.ALLOW,
          actions: ['secretsmanager:ListSecrets'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'EmergencyS3Access',
          effect: iam.Effect.ALLOW,
          actions: [
            's3:GetObject',
            's3:ListBucket',
          ],
          resources: [
            `arn:aws:s3:::tvault-cto-private-7a3f9c-${props.stage}`,
            `arn:aws:s3:::tvault-cto-private-7a3f9c-${props.stage}/*`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'EmergencyS3BucketDiscovery',
          effect: iam.Effect.ALLOW,
          actions: ['s3:ListAllMyBuckets'],
          resources: ['*'],
        }),
      ],
    })
    this.ctoKawakami.attachInlinePolicy(ctoEmergencyPolicy)

    this.ctoKawakamiAccessKey = new iam.AccessKey(this, 'CtoKawakamiAccessKey', {
      user: this.ctoKawakami,
    })

    // svc-web-backend: T6 用 (Flag タグ付き)
    this.svcWebBackend = new iam.User(this, 'SvcWebBackend', {
      userName: iamUserNames.svcWebBackend,
    })
    cdk.Tags.of(this.svcWebBackend).add('Flag', 'TVAULT:aws_cli_first_step_complete')
    cdk.Tags.of(this.svcWebBackend).add('FlagFormat', 'replace-colon-with-braces')

    const svcWebBackendArn = `arn:aws:iam::${this.account}:user/${iamUserNames.svcWebBackend}`
    const svcWebBackendPolicy = new iam.ManagedPolicy(this, 'SvcWebBackendPolicy', {
      managedPolicyName: `SvcWebBackendPolicy-${props.stage}`,
      statements: [
        new iam.PolicyStatement({
          sid: 'StsIdentityCheck',
          effect: iam.Effect.ALLOW,
          actions: ['sts:GetCallerIdentity'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'IamSelfTagInspection',
          effect: iam.Effect.ALLOW,
          actions: ['iam:GetUser', 'iam:ListUserTags'],
          resources: [svcWebBackendArn],
        }),
      ],
    })
    this.svcWebBackend.addManagedPolicy(svcWebBackendPolicy)

    // === IAM Roles ===

    // DataAnalystRole: svc-portal-dev のみが AssumeRole 可能
    this.dataAnalystRole = new iam.Role(this, 'DataAnalystRole', {
      roleName: `DataAnalystRole-${props.stage}`,
      description: 'TVAULT{assume_role_is_lateral_movement}',
      assumedBy: new iam.ArnPrincipal(svcPortalDevArn),
    })

    const dataAnalystPolicy = new iam.ManagedPolicy(this, 'DataAnalystPolicy', {
      managedPolicyName: `DataAnalystPolicy-${props.stage}`,
      statements: [
        new iam.PolicyStatement({
          sid: 'S3TargetDataRead',
          effect: iam.Effect.ALLOW,
          actions: ['s3:GetObject', 's3:ListBucket'],
          resources: [
            `arn:aws:s3:::techvault-internal-2026-${props.stage}`,
            `arn:aws:s3:::techvault-internal-2026-${props.stage}/*`,
            `arn:aws:s3:::tvault-cto-private-7a3f9c-${props.stage}`,
            `arn:aws:s3:::tvault-cto-private-7a3f9c-${props.stage}/*`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'S3CloudTrailInvestigationRead',
          effect: iam.Effect.ALLOW,
          actions: ['s3:GetObject'],
          resources: [
            `arn:aws:s3:::techvault-cloudtrail-logs-${props.stage}/stage4/cloudtrail-logs.zip`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'S3CloudTrailInvestigationList',
          effect: iam.Effect.ALLOW,
          actions: ['s3:ListBucket'],
          resources: [`arn:aws:s3:::techvault-cloudtrail-logs-${props.stage}`],
          conditions: {
            StringLike: {
              's3:prefix': ['stage4', 'stage4/*'],
            },
          },
        }),
        new iam.PolicyStatement({
          sid: 'S3BucketDiscovery',
          effect: iam.Effect.ALLOW,
          actions: ['s3:ListAllMyBuckets'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'IamSelfInlinePolicyInspection',
          effect: iam.Effect.ALLOW,
          actions: [
            'iam:ListRolePolicies',
            'iam:GetRolePolicy',
          ],
          resources: [`arn:aws:iam::${this.account}:role/DataAnalystRole-${props.stage}`],
        }),
        new iam.PolicyStatement({
          sid: 'Ec2DescribeForInventory',
          effect: iam.Effect.ALLOW,
          actions: ['ec2:DescribeInstances'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'SecretsManagerDiscovery',
          effect: iam.Effect.ALLOW,
          actions: ['secretsmanager:ListSecrets'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'SecretsManagerTargetRead',
          effect: iam.Effect.ALLOW,
          actions: ['secretsmanager:GetSecretValue'],
          resources: [
            `arn:aws:secretsmanager:ap-northeast-1:${this.account}:secret:tvault/evidence/password-*`,
            `arn:aws:secretsmanager:ap-northeast-1:${this.account}:secret:tvault/cto/backup-key-*`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'LambdaInspection',
          effect: iam.Effect.ALLOW,
          actions: ['lambda:ListFunctions'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'LambdaTargetInspection',
          effect: iam.Effect.ALLOW,
          actions: [
            'lambda:GetFunctionConfiguration',
          ],
          resources: [
            `arn:aws:lambda:ap-northeast-1:${this.account}:function:techvault-data-processor-${props.stage}`,
            `arn:aws:lambda:us-east-1:${this.account}:function:techvault-data-processor`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'SsmTargetRead',
          effect: iam.Effect.ALLOW,
          actions: [
            'ssm:GetParameter',
            'ssm:GetParametersByPath',
          ],
          resources: [
            `arn:aws:ssm:ap-northeast-1:${this.account}:parameter/techvault`,
            `arn:aws:ssm:ap-northeast-1:${this.account}:parameter/techvault/*`,
            `arn:aws:ssm:us-east-1:${this.account}:parameter/techvault`,
            `arn:aws:ssm:us-east-1:${this.account}:parameter/techvault/*`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'SsmParameterDecrypt',
          effect: iam.Effect.ALLOW,
          actions: [
            'kms:Decrypt',
          ],
          resources: ['*'],
          conditions: {
            StringLike: {
              'kms:ViaService': [
                'ssm.ap-northeast-1.amazonaws.com',
                'ssm.us-east-1.amazonaws.com',
              ],
            },
          },
        }),
        new iam.PolicyStatement({
          sid: 'EcrRepositoryDiscovery',
          effect: iam.Effect.ALLOW,
          actions: [
            'ecr:DescribeRepositories',
            'ecr:GetAuthorizationToken',
          ],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'EcrTargetAnalysis',
          effect: iam.Effect.ALLOW,
          actions: [
            'ecr:DescribeImages',
            'ecr:BatchGetImage',
            'ecr:GetDownloadUrlForLayer',
          ],
          resources: [
            `arn:aws:ecr:ap-northeast-1:${this.account}:repository/techvault/data-processor-${props.stage}`,
            `arn:aws:ecr:us-east-1:${this.account}:repository/techvault/data-processor`,
            `arn:aws:ecr:us-east-1:${this.account}:repository/techvault/data-processor-${props.stage}`,
          ],
        }),
      ],
    })
    this.dataAnalystRole.addManagedPolicy(dataAnalystPolicy)

    // EC2InstanceRole
    this.ec2InstanceRole = new iam.Role(this, 'EC2InstanceRole', {
      roleName: `EC2InstanceRole-${props.stage}`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    })

    const ec2AnalysisPolicy = new iam.ManagedPolicy(this, 'EC2AnalysisPolicy', {
      managedPolicyName: `EC2AnalysisPolicy-${props.stage}`,
      statements: [
        new iam.PolicyStatement({
          sid: 'S3CtoEvidenceRead',
          effect: iam.Effect.ALLOW,
          actions: ['s3:GetObject', 's3:ListBucket'],
          resources: [
            `arn:aws:s3:::tvault-cto-private-7a3f9c-${props.stage}`,
            `arn:aws:s3:::tvault-cto-private-7a3f9c-${props.stage}/*`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'S3BucketDiscovery',
          effect: iam.Effect.ALLOW,
          actions: ['s3:ListAllMyBuckets'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'Ec2SelfDescribe',
          effect: iam.Effect.ALLOW,
          actions: ['ec2:DescribeInstances'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'SsmParameterRead',
          effect: iam.Effect.ALLOW,
          actions: ['ssm:GetParameter'],
          resources: [`arn:aws:ssm:ap-northeast-1:${this.account}:parameter/techvault/ec2/*`],
        }),
      ],
    })
    this.ec2InstanceRole.addManagedPolicy(ec2AnalysisPolicy)

    this.ec2InstanceProfile = new iam.InstanceProfile(this, 'EC2InstanceProfile', {
      instanceProfileName: `EC2InstanceProfile-${props.stage}`,
      role: this.ec2InstanceRole,
    })

    // LambdaExecutionRole-portal
    this.lambdaPortalRole = new iam.Role(this, 'LambdaPortalRole', {
      roleName: `LambdaExecutionRole-portal-${props.stage}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    })

    const lambdaPortalPolicy = new iam.ManagedPolicy(this, 'LambdaPortalPolicy', {
      managedPolicyName: `LambdaPortalPolicy-${props.stage}`,
      statements: [
        new iam.PolicyStatement({
          sid: 'CognitoUserLookup',
          effect: iam.Effect.ALLOW,
          actions: ['cognito-idp:AdminGetUser'],
          resources: [`arn:aws:cognito-idp:ap-northeast-1:${this.account}:userpool/*`],
        }),
        new iam.PolicyStatement({
          sid: 'BedrockInference',
          effect: iam.Effect.ALLOW,
          actions: ['bedrock:InvokeModel'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'S3PublicAssets',
          effect: iam.Effect.ALLOW,
          actions: ['s3:GetObject'],
          resources: [`arn:aws:s3:::techvault-public-assets-${props.stage}/*`],
        }),
      ],
    })
    this.lambdaPortalRole.addManagedPolicy(lambdaPortalPolicy)

    // LambdaExecutionRole-processor
    this.lambdaProcessorRole = new iam.Role(this, 'LambdaProcessorRole', {
      roleName: `LambdaExecutionRole-processor-${props.stage}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    })

    const lambdaProcessorPolicy = new iam.ManagedPolicy(this, 'LambdaProcessorPolicy', {
      managedPolicyName: `LambdaProcessorPolicy-${props.stage}`,
      statements: [
        new iam.PolicyStatement({
          sid: 'S3ProcessingAccess',
          effect: iam.Effect.ALLOW,
          actions: ['s3:GetObject', 's3:ListBucket'],
          resources: [
            `arn:aws:s3:::techvault-internal-2026-${props.stage}`,
            `arn:aws:s3:::techvault-internal-2026-${props.stage}/*`,
          ],
        }),
        new iam.PolicyStatement({
          sid: 'SsmConfigRead',
          effect: iam.Effect.ALLOW,
          actions: ['ssm:GetParameter', 'ssm:GetParametersByPath'],
          resources: [`arn:aws:ssm:ap-northeast-1:${this.account}:parameter/techvault/*`],
        }),
        new iam.PolicyStatement({
          sid: 'DbSecretAccess',
          effect: iam.Effect.ALLOW,
          actions: ['secretsmanager:GetSecretValue'],
          resources: [`arn:aws:secretsmanager:ap-northeast-1:${this.account}:secret:tvault/internal/db-*`],
        }),
      ],
    })
    this.lambdaProcessorRole.addManagedPolicy(lambdaProcessorPolicy)

    // Access keys are intentionally reachable through the CTF path, not CloudFormation outputs.
  }
}
