import * as cdk from 'aws-cdk-lib'
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as logs from 'aws-cdk-lib/aws-logs'
import type { Construct } from 'constructs'
import type { CtfS3Stack } from './ctf-s3-stack'
import { generateCloudTrailAssets } from './cloudtrail-assets'

interface CtfCloudTrailStackProps extends cdk.StackProps {
  stage: string
  s3Stack: CtfS3Stack
}

export class CtfCloudTrailStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CtfCloudTrailStackProps) {
    super(scope, id, props)

    const generatedCloudTrailAssets = generateCloudTrailAssets(
      undefined,
      this.account,
      this.region,
    )

    // CloudWatch Logs グループ
    const logGroup = new logs.LogGroup(this, 'CloudTrailLogGroup', {
      logGroupName: `/aws/cloudtrail/techvault-${props.stage}`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // CloudTrail
    new cloudtrail.Trail(this, 'TechVaultTrail', {
      trailName: `techvault-trail-${props.stage}`,
      bucket: props.s3Stack.cloudTrailBucket,
      isMultiRegionTrail: true,
      includeGlobalServiceEvents: true,
      enableFileValidation: true,
      cloudWatchLogGroup: logGroup,
      sendToCloudWatchLogs: true,
      managementEvents: cloudtrail.ReadWriteType.ALL,
    })

    // 事前生成ログを実際の CloudTrail 配信キー構成でデプロイ
    new s3deploy.BucketDeployment(this, 'DeployCloudTrailLogs', {
      sources: [s3deploy.Source.asset(generatedCloudTrailAssets.cloudTrailDir)],
      destinationBucket: props.s3Stack.cloudTrailBucket,
      prune: false,
    })

    new s3deploy.BucketDeployment(this, 'DeployStage4CloudTrailZip', {
      sources: [s3deploy.Source.asset(generatedCloudTrailAssets.stage4Dir)],
      destinationBucket: props.s3Stack.cloudTrailBucket,
      destinationKeyPrefix: 'stage4',
      prune: false,
    })
  }
}
