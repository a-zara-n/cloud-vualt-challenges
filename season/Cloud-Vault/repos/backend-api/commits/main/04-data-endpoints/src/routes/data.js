const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');
const s3Service = require('../services/s3');

/**
 * Data processing endpoints
 * All routes require authentication
 */

// List objects in a bucket prefix
router.get('/objects', authenticate, async (req, res, next) => {
  try {
    const { prefix, maxKeys } = req.query;
    const objects = await s3Service.listObjects({
      prefix: prefix || '',
      maxKeys: parseInt(maxKeys, 10) || 100,
    });

    res.json({
      count: objects.length,
      objects,
    });
  } catch (error) {
    next(error);
  }
});

// Get a specific object
router.get('/objects/:key(*)', authenticate, async (req, res, next) => {
  try {
    const { key } = req.params;
    const data = await s3Service.getObject(key);

    if (!data) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Object '${key}' not found`,
      });
    }

    res.json({
      key,
      data,
    });
  } catch (error) {
    next(error);
  }
});

// Upload data
router.post('/objects', authenticate, validateBody({
  key: { required: true, type: 'string', minLength: 1, maxLength: 1024 },
  content: { required: true, type: 'string' },
  contentType: { type: 'string' },
}), async (req, res, next) => {
  try {
    const { key, content, contentType } = req.body;

    await s3Service.putObject(key, content, contentType);

    res.status(201).json({
      message: 'Object uploaded successfully',
      key,
    });
  } catch (error) {
    next(error);
  }
});

// Delete object
router.delete('/objects/:key(*)', authenticate, async (req, res, next) => {
  try {
    const { key } = req.params;
    await s3Service.deleteObject(key);

    res.json({
      message: 'Object deleted successfully',
      key,
    });
  } catch (error) {
    next(error);
  }
});

// Generate presigned URL for direct upload
router.post('/upload-url', authenticate, validateBody({
  key: { required: true, type: 'string' },
  contentType: { required: true, type: 'string' },
  expiresIn: { type: 'number' },
}), async (req, res, next) => {
  try {
    const { key, contentType, expiresIn } = req.body;
    const url = await s3Service.getPresignedUploadUrl(key, contentType, expiresIn);

    res.json({
      uploadUrl: url,
      key,
      expiresIn: expiresIn || 3600,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
