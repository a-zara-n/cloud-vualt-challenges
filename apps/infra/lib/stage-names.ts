export function stageScopedName(baseName: string, stage: string): string {
  return stage === 'prod' ? baseName : `${baseName}-${stage}`
}

export function getIamUserNames(stage: string): {
  svcPortalDev: string
  ctoKawakami: string
  svcWebBackend: string
} {
  return {
    svcPortalDev: stageScopedName('svc-portal-dev', stage),
    ctoKawakami: stageScopedName('cto-kawakami', stage),
    svcWebBackend: stageScopedName('svc-web-backend', stage),
  }
}

export function getChallengeSecretNames(stage: string): {
  evidencePassword: string
  internalDb: string
  ctoBackupKey: string
} {
  return {
    evidencePassword: stageScopedName('tvault/evidence/password', stage),
    internalDb: stageScopedName('tvault/internal/db', stage),
    ctoBackupKey: stageScopedName('tvault/cto/backup-key', stage),
  }
}

export function getTechVaultParameterNames(stage: string): {
  internalApiKey: string
  internalDbPassword: string
  configRegion: string
} {
  return {
    internalApiKey: stageScopedName('/techvault/internal/api-key', stage),
    internalDbPassword: stageScopedName('/techvault/internal/db-password', stage),
    configRegion: stageScopedName('/techvault/config/region', stage),
  }
}
