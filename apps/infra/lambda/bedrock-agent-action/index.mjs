import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({});

async function streamToString(body) {
  if (!body) return "";
  return await body.transformToString();
}

async function loadProjectMetadata() {
  const bucket = process.env.STAGE2G_BUCKET;
  const key = process.env.STAGE2G_KEY ?? "stage2g/project-metadata.json";
  if (!bucket) {
    throw new Error("STAGE2G_BUCKET is not configured");
  }

  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return JSON.parse(await streamToString(object.Body));
}

export async function handler(event) {
  const actionGroup = event.actionGroup ?? "TechVaultDataLookup";
  const apiPath = event.apiPath ?? "/project-metadata";
  const httpMethod = event.httpMethod ?? "GET";

  const metadata = await loadProjectMetadata();
  const body = JSON.stringify(metadata);

  return {
    messageVersion: "1.0",
    response: {
      actionGroup,
      apiPath,
      httpMethod,
      httpStatusCode: 200,
      responseBody: {
        "application/json": {
          body,
        },
      },
    },
  };
}
