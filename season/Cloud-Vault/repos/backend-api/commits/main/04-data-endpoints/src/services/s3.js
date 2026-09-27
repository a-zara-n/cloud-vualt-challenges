const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'techvault-data';

/**
 * S3 service for object storage operations
 */
class S3Service {
  /**
   * List objects in the bucket
   * @param {Object} options
   * @param {string} [options.prefix=''] - Key prefix filter
   * @param {number} [options.maxKeys=100] - Maximum number of keys to return
   * @returns {Promise<Object[]>}
   */
  async listObjects({ prefix = '', maxKeys = 100 } = {}) {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    const response = await s3Client.send(command);
    return (response.Contents || []).map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified,
      etag: obj.ETag,
    }));
  }

  /**
   * Get an object from S3
   * @param {string} key - Object key
   * @returns {Promise<Object|null>}
   */
  async getObject(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });

      const response = await s3Client.send(command);
      const body = await this._streamToString(response.Body);

      return {
        body,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        contentLength: response.ContentLength,
      };
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Put an object into S3
   * @param {string} key - Object key
   * @param {string|Buffer} content - Object content
   * @param {string} [contentType='application/json'] - Content type
   * @returns {Promise<void>}
   */
  async putObject(key, content, contentType = 'application/json') {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: typeof content === 'string' ? content : JSON.stringify(content),
      ContentType: contentType,
    });

    await s3Client.send(command);
  }

  /**
   * Delete an object from S3
   * @param {string} key - Object key
   * @returns {Promise<void>}
   */
  async deleteObject(key) {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
  }

  /**
   * Generate a presigned URL for direct upload
   * @param {string} key - Object key
   * @param {string} contentType - Content type
   * @param {number} [expiresIn=3600] - URL expiration in seconds
   * @returns {Promise<string>}
   */
  async getPresignedUploadUrl(key, contentType, expiresIn = 3600) {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  }

  /**
   * Convert readable stream to string
   * @private
   */
  async _streamToString(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
}

module.exports = new S3Service();
