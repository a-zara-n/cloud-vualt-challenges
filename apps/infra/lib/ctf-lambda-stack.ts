import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigw from 'aws-cdk-lib/aws-apigateway'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as path from 'path'
import type { Construct } from 'constructs'
import type { CtfVpcStack } from './ctf-vpc-stack'
import type { CtfIamStack } from './ctf-iam-stack'
import type { CtfS3Stack } from './ctf-s3-stack'
import { getLambdaInvokeTarget } from './lambda-provisioning'
import { getLambdaScaleSettings } from './lambda-scale'
import { getIamUserNames, getTechVaultParameterNames } from './stage-names'

interface CtfLambdaStackProps extends cdk.StackProps {
  stage: string
  vpcStack: CtfVpcStack
  iamStack: CtfIamStack
  s3Stack: CtfS3Stack
  internalFetchEndpoint: string
}

export class CtfLambdaStack extends cdk.Stack {
  public readonly restApi: apigw.RestApi

  constructor(scope: Construct, id: string, props: CtfLambdaStackProps) {
    super(scope, id, props)

    const lambdaDir = path.join(__dirname, '../lambda')
    const portalAuthScale = getLambdaScaleSettings(props.stage, 'portalAuth')
    const portalFetchScale = getLambdaScaleSettings(props.stage, 'portalFetch')
    const portalChatScale = getLambdaScaleSettings(props.stage, 'portalChat')
    const portalAdminScale = getLambdaScaleSettings(props.stage, 'portalAdmin')
    const dataProcessorScale = getLambdaScaleSettings(props.stage, 'dataProcessor')
    const iamUserNames = getIamUserNames(props.stage)
    const techVaultParameters = getTechVaultParameterNames(props.stage)
    const svcPortalDevAccessKey = new iam.AccessKey(this, 'SvcPortalDevDebugAccessKey', {
      user: iam.User.fromUserName(this, 'SvcPortalDevDebugUser', iamUserNames.svcPortalDev),
    })

    // portal-auth (Stage 0: debug レスポンスにクレデンシャル含む)
    const portalAuth = new lambda.Function(this, 'PortalAuth', {
      functionName: `portal-auth-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(lambdaDir, 'portal-auth')),
      memorySize: portalAuthScale.memorySize,
      reservedConcurrentExecutions: portalAuthScale.reservedConcurrentExecutions,
      timeout: cdk.Duration.seconds(30),
      role: props.iamStack.lambdaPortalRole,
      environment: {
        DEBUG_ACCESS_KEY_ID: svcPortalDevAccessKey.accessKeyId,
        DEBUG_SECRET_ACCESS_KEY: svcPortalDevAccessKey.secretAccessKey.unsafeUnwrap(),
        COGNITO_USER_POOL_ID: 'ap-northeast-1_PLACEHOLDER',
      },
    })

    // portal-fetch (Stage 3B: 告知リンクプレビューのSSRF)
    const portalFetch = new lambda.Function(this, 'PortalFetch', {
      functionName: `portal-fetch-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(lambdaDir, 'portal-fetch')),
      memorySize: portalFetchScale.memorySize,
      reservedConcurrentExecutions: portalFetchScale.reservedConcurrentExecutions,
      timeout: cdk.Duration.seconds(30),
      role: props.iamStack.lambdaPortalRole,
      vpc: props.vpcStack.vpc,
      vpcSubnets: { subnets: [props.vpcStack.privateSubnetA] },
      securityGroups: [props.vpcStack.sgLambdaVpc],
      environment: {
        INTERNAL_SERVICE_BASE_URL: props.internalFetchEndpoint,
      },
    })

    // portal-chat (Stage 1D: Prompt Injection 用 AI チャット)
    const portalChat = new lambda.Function(this, 'PortalChat', {
      functionName: `portal-chat-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(lambdaDir, 'portal-chat')),
      memorySize: portalChatScale.memorySize,
      reservedConcurrentExecutions: portalChatScale.reservedConcurrentExecutions,
      timeout: cdk.Duration.seconds(60),
      role: props.iamStack.lambdaPortalRole,
      environment: {
        BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID ?? 'jp.amazon.nova-2-lite-v1:0',
        BEDROCK_RUNTIME_REGION:
          process.env.BEDROCK_RUNTIME_REGION ??
          process.env.AWS_BEDROCK_REGION ??
          'ap-northeast-1',
      },
    })

    // portal-admin (Stage 3C: Cognito admin bypass 用)
    const portalAdmin = new lambda.Function(this, 'PortalAdmin', {
      functionName: `portal-admin-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(lambdaDir, 'portal-admin')),
      memorySize: portalAdminScale.memorySize,
      reservedConcurrentExecutions: portalAdminScale.reservedConcurrentExecutions,
      timeout: cdk.Duration.seconds(30),
      role: props.iamStack.lambdaPortalRole,
      environment: {
        COGNITO_USER_POOL_ID: 'ap-northeast-1_PLACEHOLDER',
      },
    })

    // techvault-data-processor (Stage 2D: 環境変数にフラグ)
    const dataProcessor = new lambda.Function(this, 'DataProcessor', {
      functionName: `techvault-data-processor-${props.stage}`,
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset(path.join(lambdaDir, 'data-processor')),
      memorySize: dataProcessorScale.memorySize,
      reservedConcurrentExecutions: dataProcessorScale.reservedConcurrentExecutions,
      timeout: cdk.Duration.seconds(300),
      architecture: lambda.Architecture.ARM_64,
      role: props.iamStack.lambdaProcessorRole,
      environment: {
        DB_HOST: 'internal-db.techvault.local',
        DB_PORT: '5432',
        DB_NAME: 'techvault_analytics',
        DB_USER: 'processor_user',
        LOG_LEVEL: 'debug',
        SSM_SECRET_PATH: techVaultParameters.internalApiKey,
        FLAG: 'TVAULT{lambda_env_is_not_a_vault}',
      },
    })

    const portalAuthInvokeTarget = getLambdaInvokeTarget(
      this,
      'PortalAuth',
      portalAuth,
      portalAuthScale
    )
    const portalFetchInvokeTarget = getLambdaInvokeTarget(
      this,
      'PortalFetch',
      portalFetch,
      portalFetchScale
    )
    const portalChatInvokeTarget = getLambdaInvokeTarget(
      this,
      'PortalChat',
      portalChat,
      portalChatScale
    )
    const portalAdminInvokeTarget = getLambdaInvokeTarget(
      this,
      'PortalAdmin',
      portalAdmin,
      portalAdminScale
    )
    getLambdaInvokeTarget(this, 'DataProcessor', dataProcessor, dataProcessorScale)

    // REST API Gateway
    this.restApi = new apigw.RestApi(this, 'PortalApi', {
      restApiName: `techvault-portal-api-${props.stage}`,
      description: 'TechVault Portal API',
      deployOptions: {
        stageName: 'prod',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    })

    const api = this.restApi.root.addResource('api')

    // POST /api/auth
    const authResource = api.addResource('auth')
    authResource.addMethod('POST', new apigw.LambdaIntegration(portalAuthInvokeTarget))

    // GET /api/announcements/preview
    const announcementsResource = api.addResource('announcements')
    const previewResource = announcementsResource.addResource('preview')
    previewResource.addMethod('GET', new apigw.LambdaIntegration(portalFetchInvokeTarget))

    // POST /api/chat
    const chatResource = api.addResource('chat')
    chatResource.addMethod('POST', new apigw.LambdaIntegration(portalChatInvokeTarget))

    // /api/admin/*
    const adminResource = api.addResource('admin')
    const adminUsersResource = adminResource.addResource('users')
    adminUsersResource.addMethod('GET', new apigw.LambdaIntegration(portalAdminInvokeTarget))

    // GET /api/config
    const configResource = api.addResource('config')
    configResource.addMethod('GET', new apigw.LambdaIntegration(portalAuthInvokeTarget))

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.restApi.url,
      description: 'TechVault Portal API URL',
    })
  }
}
