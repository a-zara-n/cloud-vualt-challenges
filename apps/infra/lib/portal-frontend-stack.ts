import * as cdk from 'aws-cdk-lib'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as path from 'path'
import type { Construct } from 'constructs'
import { configureHttpApiCustomDomain } from './custom-domain'
import { getLambdaInvokeTarget } from './lambda-provisioning'
import { getLambdaScaleSettings } from './lambda-scale'
import { getIamUserNames } from './stage-names'

interface PortalFrontendStackProps extends cdk.StackProps {
  stage: string
  cognitoUserPoolId: string
  cognitoUserPoolClientId: string
  vpc?: ec2.IVpc
  vpcSubnets?: ec2.SubnetSelection
  securityGroups?: ec2.ISecurityGroup[]
  internalFetchEndpoint?: string
}

export class PortalFrontendStack extends cdk.Stack {
  public readonly portalUrl: string

  constructor(scope: Construct, id: string, props: PortalFrontendStackProps) {
    super(scope, id, props)

    const scale = getLambdaScaleSettings(props.stage, 'portalFrontend')
    const isLocal = props.stage === 'local'
    const localEndpoint = 'http://host.docker.internal:4566'
    const defaultChatProvider = isLocal ? '' : 'bedrock'
    const chatProvider = process.env.PORTAL_CHAT_PROVIDER ?? defaultChatProvider
    const iamUserNames = getIamUserNames(props.stage)
    const stage0DebugAccessKey = isLocal
      ? undefined
      : new iam.AccessKey(this, 'Stage0DebugAccessKey', {
          user: iam.User.fromUserName(this, 'Stage0DebugUser', iamUserNames.svcPortalDev),
        })
    const tutorialAccessKey = new iam.AccessKey(this, 'TutorialWebBackendAccessKey', {
      user: iam.User.fromUserName(this, 'TutorialWebBackendUser', iamUserNames.svcWebBackend),
    })
    const portalAdminEmail = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'PortalAdminEmail',
      {
        parameterName: `/ctf/${props.stage}/portal-admin-email`,
      },
    )
    const portalAdminPassword = ssm.StringParameter.fromSecureStringParameterAttributes(
      this,
      'PortalAdminPassword',
      {
        parameterName: `/ctf/${props.stage}/portal-admin-password`,
      },
    )

    const fn = new lambda.DockerImageFunction(this, 'PortalFrontendHandler', {
      functionName: `techvault-portal-frontend-${props.stage}`,
      code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, '../../..'), {
        file: 'apps/portal/Dockerfile.lambda',
        platform: ecrAssets.Platform.LINUX_AMD64,
      }),
      architecture: lambda.Architecture.X86_64,
      memorySize: scale.memorySize,
      reservedConcurrentExecutions: scale.reservedConcurrentExecutions,
      timeout: cdk.Duration.seconds(30),
      vpc: props.vpc,
      vpcSubnets: props.vpc ? props.vpcSubnets ?? { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } : undefined,
      securityGroups: props.securityGroups,
      environment: {
        NODE_ENV: isLocal ? 'development' : 'production',
        CTF_STAGE: props.stage,
        // Stage 0 CTF route: keep the forgotten debug leak enabled in dev/prod too.
        DEBUG: 'true',
        AWS_ENDPOINT_URL: isLocal ? localEndpoint : '',
        LOCALSTACK_ENDPOINT: isLocal ? localEndpoint : '',
        COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
        COGNITO_CLIENT_ID: props.cognitoUserPoolClientId,
        PORTAL_ADMIN_EMAIL_PARAM: isLocal ? '' : portalAdminEmail.parameterName,
        PORTAL_ADMIN_PASSWORD_PARAM: isLocal ? '' : portalAdminPassword.parameterName,
        PORTAL_EMPLOYEE_EMAIL: process.env.PORTAL_EMPLOYEE_EMAIL ?? 'employee@techvault.example',
        PORTAL_EMPLOYEE_PASSWORD:
          process.env.PORTAL_EMPLOYEE_PASSWORD ?? 'EmployeePass2026!',
        PORTAL_AWS_ACCESS_KEY_ID: stage0DebugAccessKey?.accessKeyId ?? '',
        PORTAL_AWS_SECRET_ACCESS_KEY: stage0DebugAccessKey?.secretAccessKey.unsafeUnwrap() ?? '',
        PORTAL_TUTORIAL_AWS_ACCESS_KEY_ID: tutorialAccessKey.accessKeyId,
        PORTAL_TUTORIAL_AWS_SECRET_ACCESS_KEY: tutorialAccessKey.secretAccessKey.unsafeUnwrap(),
        PORTAL_INTERNAL_FETCH_ENDPOINT: props.internalFetchEndpoint ?? '',
        TVAULT_INTERNAL_BUCKET: `techvault-internal-2026-${props.stage}`,
        API_MASTER_KEY: 'tvault-master-3D-layer-secret-key-2026',
        STAGE5B_DISCLOSURE_TOKEN: 'tvault-route-d-disclosure-2026',
        PORTAL_CHAT_PROVIDER: chatProvider,
        BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID ?? 'jp.amazon.nova-2-lite-v1:0',
        BEDROCK_RUNTIME_REGION:
          process.env.BEDROCK_RUNTIME_REGION ??
          process.env.AWS_BEDROCK_REGION ??
          'ap-northeast-1',
        PORTAL_CHAT_PROXY_URL:
          process.env.PORTAL_CHAT_PROXY_URL ??
          (chatProvider === 'proxy' ? 'http://host.docker.internal:8787/chat' : ''),
        PORTAL_CHAT_STRICT_BEDROCK: process.env.PORTAL_CHAT_STRICT_BEDROCK ?? '',
        AWS_LWA_READINESS_CHECK_TIMEOUT: '10',
      },
    })

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          this.formatArn({
            service: 'ssm',
            resource: 'parameter',
            resourceName: `ctf/${props.stage}/portal-admin-email`,
          }),
          this.formatArn({
            service: 'ssm',
            resource: 'parameter',
            resourceName: `ctf/${props.stage}/portal-admin-password`,
          }),
        ],
      }),
    )

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: ['*'],
      }),
    )

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:AdminConfirmSignUp', 'cognito-idp:AdminUpdateUserAttributes'],
        resources: [
          this.formatArn({
            service: 'cognito-idp',
            resource: 'userpool',
            resourceName: props.cognitoUserPoolId,
          }),
        ],
      }),
    )

    const invokeTarget = getLambdaInvokeTarget(this, 'PortalFrontendHandler', fn, scale)

    const httpApi = new apigwv2.CfnApi(this, 'PortalHttpApi', {
      name: `techvault-portal-${props.stage}`,
      protocolType: 'HTTP',
    })

    const integration = new apigwv2.CfnIntegration(this, 'PortalIntegration', {
      apiId: httpApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: invokeTarget.functionArn,
      payloadFormatVersion: '2.0',
    })

    new apigwv2.CfnRoute(this, 'DefaultRoute', {
      apiId: httpApi.ref,
      routeKey: '$default',
      target: `integrations/${integration.ref}`,
    })

    const defaultStage = new apigwv2.CfnStage(this, 'DefaultStage', {
      apiId: httpApi.ref,
      stageName: '$default',
      autoDeploy: true,
    })

    invokeTarget.addPermission('PortalApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${httpApi.ref}/*/*`,
    })

    const defaultPortalUrl = isLocal
      ? `http://${httpApi.ref}.execute-api.localhost.localstack.cloud:4566`
      : `https://${httpApi.ref}.execute-api.${this.region}.amazonaws.com`
    const customDomainName = configureHttpApiCustomDomain(this, {
      api: httpApi,
      outputDescription: 'TechVault problem site custom domain URL',
      outputId: 'TechVaultCustomDomainUrl',
      service: 'techvault',
      stage: defaultStage,
      stageName: props.stage,
    })

    this.portalUrl = customDomainName ? `https://${customDomainName}` : defaultPortalUrl

    new cdk.CfnOutput(this, 'PortalUrl', {
      value: this.portalUrl,
      description: 'TechVault portal URL',
    })
  }
}
