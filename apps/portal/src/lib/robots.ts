const DEFAULT_REGION = "ap-northeast-1"
const DEFAULT_FLAG = "TVAULT{robots_txt_is_public}"

function defaultStage() {
  return process.env.NODE_ENV === "development" ? "local" : "dev"
}

export function getInternalBucketName() {
  const explicitBucket =
    process.env.TVAULT_INTERNAL_BUCKET ??
    process.env.S3_INTERNAL_BUCKET ??
    process.env.INTERNAL_BUCKET_NAME

  if (explicitBucket) return explicitBucket

  const stage =
    process.env.CTF_STAGE ??
    process.env.NEXT_PUBLIC_CTF_STAGE ??
    defaultStage()

  return `techvault-internal-2026-${stage}`
}

export function buildRobotsTxt() {
  const region = process.env.AWS_REGION ?? DEFAULT_REGION
  const bucketName = getInternalBucketName()
  const flag = process.env.T1_FLAG ?? DEFAULT_FLAG

  return [
    "User-agent: *",
    "Disallow: /admin/",
    "Disallow: /internal/",
    "Disallow: /debug/status",
    "",
    `# S3バケット: ${bucketName}.s3.${region}.amazonaws.com`,
    "# TODO: remove before production",
    `# FLAG: ${flag}`,
    "",
  ].join("\n")
}
