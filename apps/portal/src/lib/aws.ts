// AWS SDK設定（LocalStack対応）
export const awsConfig = {
  region: process.env.AWS_REGION ?? "ap-northeast-1",
  ...(process.env.AWS_ENDPOINT_URL
    ? {
        endpoint: process.env.AWS_ENDPOINT_URL,
        forcePathStyle: true,
      }
    : {}),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
  },
};
