import * as cdk from 'aws-cdk-lib'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as cr from 'aws-cdk-lib/custom-resources'
import * as path from 'path'
import type { Construct } from 'constructs'
import { generateS3Assets } from './s3-assets'
import { getChallengeSecretNames } from './stage-names'

interface CtfS3StackProps extends cdk.StackProps {
  stage: string
}

export class CtfS3Stack extends cdk.Stack {
  public readonly publicAssetsBucket: s3.Bucket
  public readonly internalBucket: s3.Bucket
  public readonly ctoPrivateBucket: s3.Bucket
  public readonly cloudTrailBucket: s3.Bucket

  constructor(scope: Construct, id: string, props: CtfS3StackProps) {
    super(scope, id, props)

    const assetsDir = path.join(__dirname, '../assets/s3')
    const generatedAssets = generateS3Assets(props.stage)
    const secretNames = getChallengeSecretNames(props.stage)
    const deployObjectsWithCdk = props.stage !== 'local'

    // 1. techvault-public-assets (パブリック)
    this.publicAssetsBucket = new s3.Bucket(this, 'PublicAssets', {
      bucketName: `techvault-public-assets-${props.stage}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.S3_MANAGED,
    })

    this.publicAssetsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowPublicRead',
        effect: iam.Effect.ALLOW,
        principals: [new iam.StarPrincipal()],
        actions: ['s3:GetObject'],
        resources: [this.publicAssetsBucket.arnForObjects('*')],
      }),
    )

    if (deployObjectsWithCdk) {
      new s3deploy.BucketDeployment(this, 'DeployPublicAssets', {
        sources: [s3deploy.Source.asset(path.join(assetsDir, 'techvault-public-assets'))],
        destinationBucket: this.publicAssetsBucket,
      })
    }

    // 2. techvault-internal-2026 (バージョニング有効)
    this.internalBucket = new s3.Bucket(this, 'Internal', {
      bucketName: `techvault-internal-2026-${props.stage}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.S3_MANAGED,
    })

    if (deployObjectsWithCdk) {
      const internalAssetsDeployment = new s3deploy.BucketDeployment(this, 'DeployInternalAssets', {
        sources: [s3deploy.Source.asset(generatedAssets.internalBucketDir)],
        destinationBucket: this.internalBucket,
      })
      const passwordHintKey = 'documents/password_hint.txt'
      const passwordHintPath = path.join(
        __dirname,
        '../assets/s3-version-history/techvault-internal-2026/documents/password_hint.txt.v1',
      )
      const passwordHintBody = fs
        .readFileSync(passwordHintPath, 'utf8')
        .replace('Secret name: tvault/evidence/password', `Secret name: ${secretNames.evidencePassword}`)
      const passwordHintHash = crypto.createHash('sha256').update(passwordHintBody).digest('hex')
      const passwordHintPolicy = cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['s3:PutObject', 's3:DeleteObject'],
          resources: [this.internalBucket.arnForObjects(passwordHintKey)],
        }),
      ])

      const putPasswordHint = new cr.AwsCustomResource(this, 'PutStage2APasswordHint', {
        onCreate: {
          service: 'S3',
          action: 'putObject',
          parameters: {
            Bucket: this.internalBucket.bucketName,
            Key: passwordHintKey,
            Body: passwordHintBody,
            ContentType: 'text/plain; charset=utf-8',
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            `stage2a-password-hint-put-${props.stage}-${passwordHintHash}`,
          ),
        },
        onUpdate: {
          service: 'S3',
          action: 'putObject',
          parameters: {
            Bucket: this.internalBucket.bucketName,
            Key: passwordHintKey,
            Body: passwordHintBody,
            ContentType: 'text/plain; charset=utf-8',
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            `stage2a-password-hint-put-${props.stage}-${passwordHintHash}`,
          ),
        },
        policy: passwordHintPolicy,
        installLatestAwsSdk: false,
      })
      putPasswordHint.node.addDependency(internalAssetsDeployment)

      const deletePasswordHint = new cr.AwsCustomResource(this, 'DeleteStage2APasswordHint', {
        onCreate: {
          service: 'S3',
          action: 'deleteObject',
          parameters: {
            Bucket: this.internalBucket.bucketName,
            Key: passwordHintKey,
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            `stage2a-password-hint-delete-${props.stage}-${passwordHintHash}`,
          ),
        },
        onUpdate: {
          service: 'S3',
          action: 'deleteObject',
          parameters: {
            Bucket: this.internalBucket.bucketName,
            Key: passwordHintKey,
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            `stage2a-password-hint-delete-${props.stage}-${passwordHintHash}`,
          ),
        },
        policy: passwordHintPolicy,
        installLatestAwsSdk: false,
      })
      deletePasswordHint.node.addDependency(putPasswordHint)
    }

    // 3. tvault-cto-private (Principal: root = 意図的ミス)
    this.ctoPrivateBucket = new s3.Bucket(this, 'CtoPrivate', {
      bucketName: `tvault-cto-private-7a3f9c-${props.stage}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.S3_MANAGED,
    })

    // 意図的な設定ミス: root を指定 = アカウント内の全 IAM エンティティがアクセス可能
    this.ctoPrivateBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'PrivateBackupAccess',
        effect: iam.Effect.ALLOW,
        principals: [new iam.AccountRootPrincipal()],
        actions: ['s3:GetObject', 's3:ListBucket'],
        resources: [
          this.ctoPrivateBucket.bucketArn,
          this.ctoPrivateBucket.arnForObjects('*'),
        ],
      }),
    )

    if (deployObjectsWithCdk) {
      new s3deploy.BucketDeployment(this, 'DeployCtoPrivate', {
        sources: [s3deploy.Source.asset(generatedAssets.ctoPrivateEvidenceDir)],
        destinationBucket: this.ctoPrivateBucket,
        destinationKeyPrefix: 'cto-evidence',
      })
    }

    // 5. techvault-cloudtrail-logs
    this.cloudTrailBucket = new s3.Bucket(this, 'CloudTrailLogs', {
      bucketName: `techvault-cloudtrail-logs-${props.stage}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(90),
        },
      ],
    })

    this.cloudTrailBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudTrailWrite',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        actions: ['s3:PutObject'],
        resources: [this.cloudTrailBucket.arnForObjects(`AWSLogs/${this.account}/*`)],
        conditions: {
          StringEquals: {
            's3:x-amz-acl': 'bucket-owner-full-control',
          },
        },
      }),
    )

    this.cloudTrailBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AllowCloudTrailBucketCheck',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
        actions: ['s3:GetBucketAcl'],
        resources: [this.cloudTrailBucket.bucketArn],
      }),
    )
  }
}
