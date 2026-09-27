import * as cdk from 'aws-cdk-lib'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets'
import * as path from 'path'
import type { Construct } from 'constructs'

interface CtfEcrStackProps extends cdk.StackProps {
  stage: string
}

export class CtfEcrStack extends cdk.Stack {
  public readonly repository: ecr.Repository

  constructor(scope: Construct, id: string, props: CtfEcrStackProps) {
    super(scope, id, props)

    // ECR リポジトリ
    this.repository = new ecr.Repository(this, 'DataProcessorRepo', {
      repositoryName: `techvault/data-processor-${props.stage}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
    })

    // Docker イメージをビルド & プッシュ
    // secret.txt が COPY → rm されるパターンでレイヤーに残る
    const dockerImage = new ecr_assets.DockerImageAsset(this, 'DataProcessorImage', {
      directory: path.join(__dirname, '../docker/data-processor'),
      platform: ecr_assets.Platform.LINUX_AMD64,
    })

    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: this.repository.repositoryUri,
      description: 'ECR Repository URI',
    })

    new cdk.CfnOutput(this, 'DockerImageUri', {
      value: dockerImage.imageUri,
      description: 'Docker Image URI (built by CDK)',
    })
  }
}
