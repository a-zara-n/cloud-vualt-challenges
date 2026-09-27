import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as path from 'node:path'
import type { Construct } from 'constructs'
import { localRestApiUrl } from './local-api-url'

interface CtfEc2EmulatorStackProps extends cdk.StackProps {
  stage: string
}

/**
 * Reproduces the challenge-facing EC2 behavior without provisioning a VM.
 * The Lambda exposes the internal service, fake DescribeInstances data and
 * the intentionally vulnerable IMDSv1 flow used by the CTF scenario.
 */
export class CtfEc2EmulatorStack extends cdk.Stack {
  public readonly internalFetchEndpoint: string
  public readonly describeInstancesEndpoint: string

  constructor(scope: Construct, id: string, props: CtfEc2EmulatorStackProps) {
    super(scope, id, props)

    const emulator = new lambda.Function(this, 'Ec2EmulatorHandler', {
      functionName: `techvault-internal-data-server-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/ec2-emulator')),
      architecture: lambda.Architecture.X86_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        CTF_STAGE: props.stage,
        EMULATED_ROLE_NAME: 'EC2InstanceRole',
      },
    })

    const api = new apigateway.LambdaRestApi(this, 'Ec2EmulatorApi', {
      restApiName: `techvault-internal-data-service-${props.stage}`,
      description: 'TechVault internal data service',
      handler: emulator,
      proxy: true,
      deployOptions: { stageName: 'internal' },
    })

    this.internalFetchEndpoint = props.stage === 'local'
      ? localRestApiUrl(api.restApiId, 'internal').replace(/\/$/, '')
      : api.url.replace(/\/$/, '')
    this.describeInstancesEndpoint = `${this.internalFetchEndpoint}/describe-instances`

    new cdk.CfnOutput(this, 'InternalFetchEndpoint', {
      value: this.internalFetchEndpoint,
      description: 'Lambda EC2 emulator internal-service endpoint',
    })
    new cdk.CfnOutput(this, 'EmulatedDescribeInstancesEndpoint', {
      value: this.describeInstancesEndpoint,
      description: 'AWS-like DescribeInstances response provided by the Lambda emulator',
    })
  }
}
