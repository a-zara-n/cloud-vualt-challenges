import { generateS3Assets } from '../lib/s3-assets'

const stage = process.argv[2] ?? process.env.CTF_STAGE ?? 'prod'
const generated = generateS3Assets(stage)

console.log(`[s3 assets] generated ${stage} ${generated.internalBucketDir}`)
console.log(`[s3 assets] generated ${stage} ${generated.ctoPrivateEvidenceDir}`)
