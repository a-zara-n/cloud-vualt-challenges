import * as cdk from 'aws-cdk-lib'
import { CtfVpcStack } from '../lib/ctf-vpc-stack'
import { CtfIamStack } from '../lib/ctf-iam-stack'
import { CtfS3Stack } from '../lib/ctf-s3-stack'
import { CtfLambdaStack } from '../lib/ctf-lambda-stack'
import { CtfEc2EmulatorStack } from '../lib/ctf-ec2-stack'
import { CtfCognitoStack } from '../lib/ctf-cognito-stack'
import { CtfSecretsStack } from '../lib/ctf-secrets-stack'
import { CtfEcrStack } from '../lib/ctf-ecr-stack'
import { CtfCloudTrailStack } from '../lib/ctf-cloudtrail-stack'
import { CtfBedrockStack } from '../lib/ctf-bedrock-stack'
import { PortalFrontendStack } from '../lib/portal-frontend-stack'
import { ChallengeServerStack } from '../lib/challenge-server-stack'

const app = new cdk.App()
const stage = app.node.tryGetContext('stage') || 'dev'
const challengeOnly = app.node.tryGetContext('challengeOnly') === 'true'
const awsEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region:
    process.env.CDK_DEFAULT_REGION ??
    process.env.AWS_REGION ??
    process.env.AWS_DEFAULT_REGION ??
    'ap-northeast-1',
}

if (challengeOnly) {
  if (stage !== 'local') {
    throw new Error('challengeOnly is supported only with --context stage=local')
  }

  new ChallengeServerStack(app, 'ctf-challenge-server-local', {
    stage: 'local',
    targetUrl: '',
  })
} else {
// Floci does not provide every production service used by this
// challenge, so CloudTrail and Bedrock are created only for AWS stages.
const localVpc = new CtfVpcStack(app, 'ctf-vpc-local', { stage: 'local' })
const localIam = new CtfIamStack(app, 'ctf-iam-local', { stage: 'local' })
const localS3 = new CtfS3Stack(app, 'ctf-s3-local', { stage: 'local' })
const localCognito = new CtfCognitoStack(app, 'ctf-cognito-local', { stage: 'local' })
const localEc2 = new CtfEc2EmulatorStack(app, 'ctf-ec2-local', {
  stage: 'local',
})
const localLambda = new CtfLambdaStack(app, 'ctf-lambda-local', {
  stage: 'local',
  vpcStack: localVpc,
  iamStack: localIam,
  s3Stack: localS3,
  internalFetchEndpoint: localEc2.internalFetchEndpoint,
})
localLambda.addStackDependency(localEc2)
const localSecrets = new CtfSecretsStack(app, 'ctf-secrets-local', { stage: 'local' })
localSecrets.addStackDependency(localIam)
new CtfEcrStack(app, 'ctf-ecr-local', { stage: 'local' })

const localPortal = new PortalFrontendStack(app, 'ctf-portal-frontend-local', {
  stage: 'local',
  cognitoUserPoolId: localCognito.userPool.userPoolId,
  cognitoUserPoolClientId: localCognito.userPoolClient.userPoolClientId,
  internalFetchEndpoint: localEc2.internalFetchEndpoint,
})
localPortal.addStackDependency(localIam)
localPortal.addStackDependency(localEc2)
const localChallengeServer = new ChallengeServerStack(app, 'ctf-challenge-server-local', {
  stage: 'local',
  targetUrl: localPortal.portalUrl,
})
localChallengeServer.addStackDependency(localPortal)

if (stage !== 'local') {
  const vpc = new CtfVpcStack(app, `ctf-vpc-${stage}`, { stage, env: awsEnv })
  const iam = new CtfIamStack(app, `ctf-iam-${stage}`, { stage, env: awsEnv })
  const s3 = new CtfS3Stack(app, `ctf-s3-${stage}`, { stage, env: awsEnv })
  const cognito = new CtfCognitoStack(app, `ctf-cognito-${stage}`, { stage, env: awsEnv })
  const ec2 = new CtfEc2EmulatorStack(app, `ctf-ec2-${stage}`, {
    stage,
    env: awsEnv,
  })

  const portal = new PortalFrontendStack(app, `ctf-portal-frontend-${stage}`, {
    stage,
    env: awsEnv,
    cognitoUserPoolId: cognito.userPool.userPoolId,
    cognitoUserPoolClientId: cognito.userPoolClient.userPoolClientId,
    vpc: vpc.vpc,
    vpcSubnets: { subnets: [vpc.privateSubnetA] },
    securityGroups: [vpc.sgLambdaVpc],
    internalFetchEndpoint: ec2.internalFetchEndpoint,
  })
  portal.addStackDependency(iam)
  portal.addStackDependency(ec2)
  const challengeServer = new ChallengeServerStack(app, `ctf-challenge-server-${stage}`, {
    stage,
    env: awsEnv,
    targetUrl: portal.portalUrl,
  })
  challengeServer.addStackDependency(portal)

  const lambda = new CtfLambdaStack(app, `ctf-lambda-${stage}`, {
    stage,
    env: awsEnv,
    vpcStack: vpc,
    iamStack: iam,
    s3Stack: s3,
    internalFetchEndpoint: ec2.internalFetchEndpoint,
  })
  lambda.addStackDependency(ec2)

  const secrets = new CtfSecretsStack(app, `ctf-secrets-${stage}`, { stage, env: awsEnv })
  secrets.addStackDependency(iam)
  new CtfEcrStack(app, `ctf-ecr-${stage}`, { stage, env: awsEnv })
  new CtfCloudTrailStack(app, `ctf-trail-${stage}`, {
    stage,
    env: awsEnv,
    s3Stack: s3,
  })
  if (stage !== 'local') {
    const bedrock = new CtfBedrockStack(app, `ctf-bedrock-${stage}`, { stage, env: awsEnv })
    bedrock.addStackDependency(iam)
  }
}
}
