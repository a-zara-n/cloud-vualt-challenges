const express = require('express');
const router = express.Router();

const startTime = Date.now();

/**
 * Health check endpoint
 * Used by ALB/API Gateway for monitoring and deployment verification
 */
router.get('/health', (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  res.json({
    status: 'healthy',
    service: 'techvault-backend-api',
    version: process.env.npm_package_version || '1.0.0',
    uptime: `${uptime}s`,
    environment: process.env.NODE_ENV || 'development',
    region: process.env.AWS_REGION || 'unknown',
    timestamp: new Date().toISOString(),
    checks: {
      memory: getMemoryStatus(),
      node: process.version,
    },
  });
});

/**
 * Detailed health check (requires auth in production)
 */
router.get('/health/detailed', (req, res) => {
  const memUsage = process.memoryUsage();

  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    memory: {
      rss: formatBytes(memUsage.rss),
      heapTotal: formatBytes(memUsage.heapTotal),
      heapUsed: formatBytes(memUsage.heapUsed),
      external: formatBytes(memUsage.external),
    },
    cpu: process.cpuUsage(),
    platform: process.platform,
    nodeVersion: process.version,
    pid: process.pid,
  });
});

function getMemoryStatus() {
  const memUsage = process.memoryUsage();
  const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  return {
    status: heapUsedPercent < 85 ? 'ok' : 'warning',
    heapUsedPercent: Math.round(heapUsedPercent),
  };
}

function formatBytes(bytes) {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

module.exports = router;
