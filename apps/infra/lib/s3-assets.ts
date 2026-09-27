import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'
import { CTO_BACKUP_KEY_VALUE, EVIDENCE_ZIP_PASSWORD } from './challenge-secrets'
import { getChallengeSecretNames } from './stage-names'

export interface GeneratedS3Assets {
  readonly rootDir: string
  readonly internalBucketDir: string
  readonly ctoPrivateEvidenceDir: string
}

const INTERNAL_BUCKET_DIR = 'techvault-internal-2026'
const INTERNAL_BUCKET_FLAG = 'TVAULT{s3_prefix_is_not_security}'
const EVIDENCE_ARCHIVE_NAME = 'encrypted_evidence.zip'
const CTO_PRIVATE_BUCKET_DIR = 'tvault-cto-private'
const CTO_EVIDENCE_PREFIX = 'cto-evidence'

function writeText(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
}

function copyRequiredFile(sourcePath: string, destinationPath: string): void {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing required S3 source asset: ${sourcePath}`)
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true })
  fs.copyFileSync(sourcePath, destinationPath)
}

function generateEncryptedEvidenceZip(infraRoot: string, generatedRoot: string): string {
  const sourceDir = path.join(infraRoot, 'assets/evidence')
  const evidenceDir = path.join(sourceDir, 'evidence')
  const workDir = path.join(generatedRoot, '.evidence-zip-work')
  const archivePath = path.join(generatedRoot, EVIDENCE_ARCHIVE_NAME)

  if (!fs.existsSync(evidenceDir)) {
    throw new Error(`Missing evidence source directory: ${evidenceDir}`)
  }

  fs.rmSync(workDir, { recursive: true, force: true })
  fs.rmSync(archivePath, { force: true })
  fs.mkdirSync(workDir, { recursive: true })
  fs.cpSync(path.join(sourceDir, 'evidence'), path.join(workDir, 'evidence'), { recursive: true })

  try {
    execFileSync('zip', ['-qr', '-P', EVIDENCE_ZIP_PASSWORD, archivePath, 'evidence'], {
      cwd: workDir,
      stdio: 'ignore',
    })
  } catch (error) {
    throw new Error(
      `Failed to generate password-protected evidence zip. Ensure the zip command is installed. Cause: ${error}`,
    )
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }

  return archivePath
}

function generateEncryptedCtoEvidence(infraRoot: string, generatedRoot: string, stage: string): string {
  const sourceDir = path.join(infraRoot, 'assets/s3', CTO_PRIVATE_BUCKET_DIR, CTO_EVIDENCE_PREFIX)
  const destinationDir = path.join(generatedRoot, CTO_PRIVATE_BUCKET_DIR, CTO_EVIDENCE_PREFIX)
  const workDir = path.join(generatedRoot, '.cto-evidence-work')
  const secretNames = getChallengeSecretNames(stage)

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Missing CTO evidence source directory: ${sourceDir}`)
  }

  fs.rmSync(destinationDir, { recursive: true, force: true })
  fs.rmSync(workDir, { recursive: true, force: true })
  fs.mkdirSync(destinationDir, { recursive: true })
  fs.mkdirSync(workDir, { recursive: true })

  try {
    for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue
      }

      const sourcePath = path.join(sourceDir, entry.name)
      const stagedSourcePath = path.join(workDir, entry.name)
      const destinationPath = path.join(destinationDir, entry.name)
      writeText(
        stagedSourcePath,
        fs
          .readFileSync(sourcePath, 'utf8')
          .replaceAll('tvault/cto/backup-key', secretNames.ctoBackupKey),
      )

      try {
        execFileSync(
          'openssl',
          [
            'enc',
            '-aes-256-cbc',
            '-salt',
            '-pbkdf2',
            '-iter',
            '100000',
            '-pass',
            `pass:${CTO_BACKUP_KEY_VALUE}`,
            '-in',
            stagedSourcePath,
            '-out',
            destinationPath,
          ],
          { stdio: 'ignore' },
        )
      } catch (error) {
        throw new Error(
          `Failed to encrypt CTO evidence asset ${sourcePath}. Ensure the openssl command is installed. Cause: ${error}`,
        )
      }
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true })
  }

  return destinationDir
}

export function generateS3Assets(stage = 'prod', projectRoot = path.resolve(__dirname, '../../..')): GeneratedS3Assets {
  const infraRoot = path.join(projectRoot, 'apps/infra')
  const generatedRoot = path.join(infraRoot, '.generated/s3', stage)
  const internalBucketDir = path.join(generatedRoot, INTERNAL_BUCKET_DIR)
  const evidenceArchivePath = generateEncryptedEvidenceZip(infraRoot, generatedRoot)
  const ctoPrivateEvidenceDir = generateEncryptedCtoEvidence(infraRoot, generatedRoot, stage)

  fs.rmSync(internalBucketDir, { recursive: true, force: true })
  fs.mkdirSync(internalBucketDir, { recursive: true })

  writeText(
    path.join(internalBucketDir, '.hidden/flag.txt'),
    `${INTERNAL_BUCKET_FLAG}\n`,
  )

  writeText(
    path.join(internalBucketDir, 'documents/readme.txt'),
    [
      'TechVault Internal Document Repository',
      '======================================',
      '',
      'Welcome to the TechVault internal document storage.',
      '',
      'Available documents:',
      '- encrypted_evidence.zip: Encrypted archive (contact admin for password)',
      '- password_hint.txt: [DELETED - contact IT support if needed]',
      '',
      'For questions, contact: it-support@techvault.local',
      '',
    ].join('\n'),
  )

  copyRequiredFile(
    evidenceArchivePath,
    path.join(internalBucketDir, 'documents', EVIDENCE_ARCHIVE_NAME),
  )

  return {
    rootDir: generatedRoot,
    internalBucketDir,
    ctoPrivateEvidenceDir,
  }
}
