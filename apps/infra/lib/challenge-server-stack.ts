import { createHash } from 'node:crypto'
import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as path from 'node:path'
import type { Construct } from 'constructs'
import { localRestApiUrl } from './local-api-url'

interface ChallengeServerStackProps extends cdk.StackProps {
  stage: string
  targetUrl: string
}

function configuredValue(name: string, fallback: string, maxBytes: number): string {
  const value = process.env[name]?.trim() || fallback
  const size = Buffer.byteLength(value, 'utf8')
  if (size > maxBytes) {
    throw new Error(`${name} must be ${maxBytes} bytes or less (received ${size})`)
  }
  return value
}

function configuredHints(): string {
  const raw = configuredValue(
    'CLOUD_VAULT_CTF_HINTS_JSON',
    JSON.stringify([
      'robots.txt とHTMLソースを確認してください。',
      'ログインに失敗したときのAPIレスポンスを確認してください。',
      '漏洩した認証情報を設定し、FlociのS3バケットを調べてください。',
    ]),
    1200,
  )

  let hints: unknown
  try {
    hints = JSON.parse(raw)
  } catch {
    throw new Error('CLOUD_VAULT_CTF_HINTS_JSON must be valid JSON')
  }

  if (!Array.isArray(hints) || hints.some((hint) => typeof hint !== 'string')) {
    throw new Error('CLOUD_VAULT_CTF_HINTS_JSON must be a JSON array of strings')
  }
  return JSON.stringify(hints)
}

function configuredTargetUrl(fallback: string): string {
  const override = process.env.CLOUD_VAULT_CTF_TARGET_URL?.trim()
  if (!override) return fallback

  let url: URL
  try {
    url = new URL(override)
  } catch {
    throw new Error('CLOUD_VAULT_CTF_TARGET_URL must be an absolute HTTP(S) URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('CLOUD_VAULT_CTF_TARGET_URL must use http or https')
  }
  if (Buffer.byteLength(override, 'utf8') > 512) {
    throw new Error('CLOUD_VAULT_CTF_TARGET_URL must be 512 bytes or less')
  }
  return override
}

export class ChallengeServerStack extends cdk.Stack {
  public readonly challengeServerUrl: string
  public readonly targetUrl: string

  constructor(scope: Construct, id: string, props: ChallengeServerStackProps) {
    super(scope, id, props)

    const points = configuredValue('CLOUD_VAULT_CTF_POINTS', '500', 6)
    if (!/^\d{1,6}$/.test(points)) {
      throw new Error('CLOUD_VAULT_CTF_POINTS must be an integer between 0 and 999999')
    }

    const flag = configuredValue(
      'CLOUD_VAULT_CTF_FLAG',
      'TVAULT{cloud_security_matters_always}',
      512,
    )
    const flagSha256 = createHash('sha256').update(flag).digest('hex')
    const basicAuthUsername = configuredValue(
      'CLOUD_VAULT_DASHBOARD_USERNAME',
      'cloudvault',
      120,
    )
    const basicAuthPassword = configuredValue(
      'CLOUD_VAULT_DASHBOARD_PASSWORD',
      'vault-ctf-2026',
      512,
    )
    const basicAuthPasswordSha256 = createHash('sha256')
      .update(basicAuthPassword)
      .digest('hex')

    const dashboardEnvironment = {
      APP_MODE: 'dashboard',
      CTF_STAGE: props.stage,
      CTF_EVENT_NAME: configuredValue(
        'CLOUD_VAULT_CTF_EVENT_NAME',
        'Cloud Vault CTF',
        120,
      ),
      CTF_CHALLENGE_ID: configuredValue(
        'CLOUD_VAULT_CTF_CHALLENGE_ID',
        'cloud-vault',
        80,
      ),
      CTF_CHALLENGE_TITLE: configuredValue(
        'CLOUD_VAULT_CTF_TITLE',
        'Cloud Vault — TechVault侵害調査',
        200,
      ),
      CTF_CHALLENGE_DESCRIPTION: configuredValue(
        'CLOUD_VAULT_CTF_DESCRIPTION',
        'TechVault社からクラウド情報漏洩の調査を依頼されました。社員ポータルを起点に漏洩経路を追い、Floci上に残された最終証拠を回収してください。',
        1600,
      ),
      CTF_CHALLENGE_CATEGORY: configuredValue(
        'CLOUD_VAULT_CTF_CATEGORY',
        'Cloud / DFIR',
        80,
      ),
      CTF_CHALLENGE_POINTS: points,
      CTF_CHALLENGE_DIFFICULTY: configuredValue(
        'CLOUD_VAULT_CTF_DIFFICULTY',
        'Scenario',
        40,
      ),
      CTF_HINTS_JSON: configuredHints(),
      CTF_FLAG_SHA256: flagSha256,
      CTF_BASIC_AUTH_USERNAME: basicAuthUsername,
      CTF_BASIC_AUTH_PASSWORD_SHA256: basicAuthPasswordSha256,
    }

    const environmentBytes = Buffer.byteLength(JSON.stringify(dashboardEnvironment), 'utf8')
    if (environmentBytes > 3800) {
      throw new Error(
        `Cloud Vault challenge configuration is too large for Lambda environment variables (${environmentBytes} bytes)`,
      )
    }

    const lambdaSource = path.join(__dirname, '../lambda/challenge-server')
    const code = lambda.Code.fromAsset(lambdaSource)

    let targetUrl = configuredTargetUrl(props.targetUrl)
    if (!targetUrl) {
      const targetFn = new lambda.Function(this, 'ProblemServerHandler', {
        functionName: `cloud-vault-problem-server-${props.stage}`,
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: 'index.handler',
        code,
        architecture: lambda.Architecture.X86_64,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: {
          APP_MODE: 'target',
          CTF_STAGE: props.stage,
        },
      })
      const targetApi = new apigateway.LambdaRestApi(this, 'ProblemRestApi', {
        restApiName: `cloud-vault-problem-server-${props.stage}`,
        handler: targetFn,
        proxy: true,
        deployOptions: { stageName: 'target' },
      })
      targetUrl =
        props.stage === 'local'
          ? localRestApiUrl(targetApi.restApiId, 'target')
          : targetApi.url
    }
    this.targetUrl = targetUrl

    const dashboardFn = new lambda.Function(this, 'DashboardHandler', {
      functionName: `cloud-vault-dashboard-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code,
      architecture: lambda.Architecture.X86_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        ...dashboardEnvironment,
        CTF_TARGET_URL: targetUrl,
      },
    })

    const dashboardApi = new apigateway.LambdaRestApi(this, 'DashboardRestApi', {
      restApiName: `cloud-vault-dashboard-${props.stage}`,
      handler: dashboardFn,
      proxy: true,
      deployOptions: {
        stageName: 'dashboard',
      },
    })

    this.challengeServerUrl =
      props.stage === 'local'
        ? localRestApiUrl(dashboardApi.restApiId, 'dashboard')
        : dashboardApi.url

    new cdk.CfnOutput(this, 'ChallengeServerUrl', {
      value: this.challengeServerUrl,
      description: 'Cloud Vault CTF dashboard URL',
    })
    new cdk.CfnOutput(this, 'ProblemServerUrl', {
      value: this.targetUrl,
      description: 'Cloud Vault problem environment URL',
    })
  }
}
