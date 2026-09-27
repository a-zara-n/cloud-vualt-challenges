import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import { execFileSync } from 'child_process'

export interface GeneratedCloudTrailAssets {
  readonly stage4Dir: string
  readonly cloudTrailDir: string
}

const STAGE4_ARCHIVE_NAME = 'cloudtrail-logs.zip'
const STAGE4_LOG_NAME = 'cloudtrail-logs.json'
const SOURCE_ACCOUNT_ID = '123456789012'
const DEFAULT_REGION = 'ap-northeast-1'

function replaceAccountId(value: unknown, accountId: string): unknown {
  if (typeof value === 'string') {
    return value.replaceAll(SOURCE_ACCOUNT_ID, accountId)
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceAccountId(item, accountId))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, replaceAccountId(nested, accountId)]),
    )
  }

  return value
}

export function generateCloudTrailAssets(
  projectRoot = path.resolve(__dirname, '../../..'),
  accountId = process.env.CDK_DEFAULT_ACCOUNT ?? SOURCE_ACCOUNT_ID,
  region = process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? DEFAULT_REGION,
): GeneratedCloudTrailAssets {
  const sourceLogPath = path.join(projectRoot, 'season/Cloud-Vault/assets', STAGE4_LOG_NAME)
  const generatedRoot = path.join(projectRoot, 'apps/infra/.generated/cloudtrail')
  const stage4Dir = path.join(generatedRoot, 'stage4')
  const cloudTrailDir = path.join(generatedRoot, 'cloudtrail')
  const cloudTrailObjectDir = path.join(
    cloudTrailDir,
    'AWSLogs',
    accountId,
    'CloudTrail',
    region,
    '2026',
    '02',
    '01',
  )
  const workDir = path.join(generatedRoot, '.stage4-zip-work')
  const archivePath = path.join(stage4Dir, STAGE4_ARCHIVE_NAME)
  const renderedLogPath = path.join(workDir, STAGE4_LOG_NAME)
  const cloudTrailObjectPath = path.join(
    cloudTrailObjectDir,
    `${accountId}_CloudTrail_${region}_20260201T0000Z_techvault.json.gz`,
  )

  if (!fs.existsSync(sourceLogPath)) {
    throw new Error(`Missing CloudTrail source log: ${sourceLogPath}`)
  }

  fs.rmSync(stage4Dir, { recursive: true, force: true })
  fs.rmSync(cloudTrailDir, { recursive: true, force: true })
  fs.rmSync(workDir, { recursive: true, force: true })
  fs.mkdirSync(stage4Dir, { recursive: true })
  fs.mkdirSync(cloudTrailObjectDir, { recursive: true })
  fs.mkdirSync(workDir, { recursive: true })

  const sourceLog = JSON.parse(fs.readFileSync(sourceLogPath, 'utf8')) as unknown
  const renderedLog = replaceAccountId(sourceLog, accountId)
  const renderedLogPretty = `${JSON.stringify(renderedLog, null, 2)}\n`
  const renderedLogCompact = JSON.stringify(renderedLog)

  fs.writeFileSync(renderedLogPath, renderedLogPretty, 'utf8')
  fs.writeFileSync(cloudTrailObjectPath, zlib.gzipSync(renderedLogCompact))

  try {
    execFileSync('zip', ['-qr', archivePath, STAGE4_LOG_NAME], {
      cwd: workDir,
      stdio: 'ignore',
    })
  } catch (error) {
    throw new Error(
      `Failed to generate Stage 4 CloudTrail zip. Ensure the zip command is installed. Cause: ${error}`,
    )
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }

  return { stage4Dir, cloudTrailDir }
}
